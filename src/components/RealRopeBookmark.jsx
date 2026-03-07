import React, { useRef, useEffect, useState } from 'react';

// Physics Constants (Internal Defaults)
const GRAVITY = 0.5;
const FRICTION = 0.92;
const STIFFNESS = 20;

export default function RealRopeBookmark({
    isBookmarked,
    onToggle,
    readOnly = false,
    variant = 'default',
    isHovered = false
}) {
    const canvasRef = useRef(null);
    const [isDragging, setIsDragging] = useState(false);
    const [isNearRope, setIsNearRope] = useState(false);

    // Dynamic config for different variants
    const config = {
        segments: variant === 'card' ? 14 : 30, // Shorter for cards
        longLen: variant === 'card' ? 8 : 11,
        shortLen: variant === 'card' ? 3 : 2.5,
        ropeWidth: variant === 'card' ? 6 : 4, // Bigger/Thicker for cards
        tasselScale: variant === 'card' ? 1.4 : 1
    };

    // Mutable Physics State - DEFINED AT TOP to avoid ReferenceErrors
    const state = useRef({
        points: [],
        constraints: [],
        mouse: { x: 0, y: 0 },
        dragOffset: { x: 0, y: 0 },
        targetSegmentLength: isBookmarked ? config.longLen : config.shortLen,
        currentSegmentLength: isBookmarked ? config.longLen : config.shortLen,
        isDragging: false,
        dragStartX: 0,
        dragStartY: 0
    });

    // Initialize Physics World and Onboarding logic
    useEffect(() => {
        const startX = 75; // Centered in a 150px canvas for more room
        const startY = 0;

        state.current.points = [];
        state.current.constraints = [];

        for (let i = 0; i < config.segments; i++) {
            state.current.points.push({
                x: startX,
                y: startY + i * state.current.currentSegmentLength,
                oldx: startX,
                oldy: startY + i * state.current.currentSegmentLength,
                pinned: i === 0
            });
        }

        for (let i = 0; i < config.segments - 1; i++) {
            state.current.constraints.push({
                p1: state.current.points[i],
                p2: state.current.points[i + 1],
                length: state.current.currentSegmentLength
            });
        }

    }, [variant]);

    // Update Target Length
    useEffect(() => {
        state.current.targetSegmentLength = isBookmarked ? config.longLen : config.shortLen;
    }, [isBookmarked, config.longLen, config.shortLen]);

    // Distance Check for Pointer Events
    useEffect(() => {
        const handleGlobalMouseMove = (e) => {
            if (isDragging) return;
            const canvas = canvasRef.current;
            if (!canvas) return;
            const rect = canvas.getBoundingClientRect();
            const mouseX = e.clientX - rect.left;
            const mouseY = e.clientY - rect.top;

            // Check distance to the bottom-most point (tassel)
            const pts = state.current.points;
            if (pts.length > 0) {
                const endP = pts[pts.length - 1];
                const dist = Math.hypot(mouseX - endP.x, mouseY - endP.y);

                // Only enable pointer events if within 60px of the tassel
                setIsNearRope(dist < 60);
            }
        };

        window.addEventListener('mousemove', handleGlobalMouseMove);
        return () => window.removeEventListener('mousemove', handleGlobalMouseMove);
    }, [isDragging]);

    // Main Animation Loop
    useEffect(() => {
        let animationFrameId;
        const ctx = canvasRef.current?.getContext('2d');

        const loop = () => {
            if (!ctx) return;
            const s = state.current;
            const pts = s.points;

            // 0. Smoothly interpolate segment length
            const diff = s.targetSegmentLength - s.currentSegmentLength;
            if (Math.abs(diff) > 0.01) {
                // Faster interpolation
                s.currentSegmentLength += diff * 0.1;
                s.constraints.forEach(c => c.length = s.currentSegmentLength);
            }

            // 1. Verlet Integration
            for (let i = 0; i < pts.length; i++) {
                const p = pts[i];
                if (!p.pinned) {
                    const vx = (p.x - p.oldx) * FRICTION;
                    const vy = (p.y - p.oldy) * FRICTION;

                    p.oldx = p.x;
                    p.oldy = p.y;

                    p.x += vx;
                    p.y += vy;
                    p.y += GRAVITY;
                }
            }

            // 2. Drag Interaction
            if (s.isDragging) {
                const endPoint = pts[pts.length - 1];

                // Constraint: Don't let it be dragged completely off-screen X
                let targetX = s.mouse.x - s.dragOffset.x;
                let targetY = s.mouse.y - s.dragOffset.y;

                // Limit drag Y range slightly to avoid weird physics glitches
                if (targetY < -100) targetY = -100;

                endPoint.x = targetX;
                endPoint.y = targetY;
            }

            // 3. Solve Constraints
            const cons = s.constraints;
            for (let k = 0; k < STIFFNESS; k++) {
                for (let i = 0; i < cons.length; i++) {
                    const c = cons[i];
                    const dx = c.p2.x - c.p1.x;
                    const dy = c.p2.y - c.p1.y;
                    const dist = Math.sqrt(dx * dx + dy * dy);

                    if (dist === 0) continue; // Prevent NaN

                    const dif = c.length - dist;
                    const percent = dif / dist / 2;
                    const offX = dx * percent;
                    const offY = dy * percent;

                    if (!c.p1.pinned) {
                        c.p1.x -= offX;
                        c.p1.y -= offY;
                    }
                    if (!c.p2.pinned) {
                        c.p2.x += offX;
                        c.p2.y += offY;
                    }
                }
            }

            // 4. Render
            ctx.clearRect(0, 0, 150, 800);

            // Draw Rope
            ctx.beginPath();
            ctx.strokeStyle = '#c0392b';
            ctx.lineWidth = config.ropeWidth;
            ctx.lineCap = 'round';
            ctx.lineJoin = 'round';

            if (pts.length > 0) {
                ctx.moveTo(pts[0].x, pts[0].y);
                for (let i = 1; i < pts.length - 1; i++) {
                    const xc = (pts[i].x + pts[i + 1].x) / 2;
                    const yc = (pts[i].y + pts[i + 1].y) / 2;
                    ctx.quadraticCurveTo(pts[i].x, pts[i].y, xc, yc);
                }
                if (pts.length > 1) {
                    ctx.lineTo(pts[pts.length - 1].x, pts[pts.length - 1].y);
                }
            }
            ctx.stroke();

            // Texture
            ctx.beginPath();
            ctx.strokeStyle = 'rgba(0, 0, 0, 0.15)';
            ctx.lineWidth = 1.5;
            ctx.moveTo(pts[0].x + 1, pts[0].y);
            for (let i = 1; i < pts.length - 1; i++) {
                const xc = (pts[i].x + pts[i + 1].x) / 2;
                const yc = (pts[i].y + pts[i + 1].y) / 2;
                ctx.quadraticCurveTo(pts[i].x + 1, pts[i].y, xc + 1, yc);
            }
            if (pts.length > 1) {
                ctx.lineTo(pts[pts.length - 1].x + 1, pts[pts.length - 1].y);
            }
            ctx.stroke();

            // Draw Tassel
            const endP = pts[pts.length - 1];
            if (endP) {
                const prevP = pts[pts.length - 2] || pts[0];

                ctx.save();
                ctx.translate(endP.x, endP.y);
                const angle = Math.atan2(endP.y - prevP.y, endP.x - prevP.x);
                ctx.rotate(angle - Math.PI / 2);
                ctx.scale(config.tasselScale, config.tasselScale);

                // Tassel Gradient
                const tasselGrad = ctx.createLinearGradient(-6, 0, 6, 0);
                tasselGrad.addColorStop(0, '#922b21');
                tasselGrad.addColorStop(0.5, '#c0392b');
                tasselGrad.addColorStop(1, '#922b21');

                ctx.fillStyle = tasselGrad;

                ctx.beginPath();
                ctx.moveTo(-6, 0);
                ctx.lineTo(6, 0);
                ctx.lineTo(8, 24);
                ctx.lineTo(-8, 24);
                ctx.closePath();
                ctx.fill();

                ctx.strokeStyle = 'rgba(0,0,0,0.2)';
                ctx.lineWidth = 1;
                ctx.beginPath();
                for (let i = 1; i < 5; i++) {
                    ctx.moveTo(-8 + i * 3, 10);
                    ctx.lineTo(-8 + i * 3, 24);
                }
                ctx.stroke();

                ctx.fillStyle = '#f1c40f';
                ctx.fillRect(-6, 2, 12, 4);

                ctx.fillStyle = '#c0392b';
                ctx.beginPath();
                ctx.arc(0, -2, 5, 0, Math.PI * 2);
                ctx.fill();

                ctx.restore();
            }

            animationFrameId = requestAnimationFrame(loop);
        };

        loop();
        return () => cancelAnimationFrame(animationFrameId);
    }, [variant, config.ropeWidth, config.tasselScale]); // Dependency on variant to resize segments properly

    const handleMouseDown = (e) => {
        const rect = canvasRef.current.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;

        const s = state.current;
        const pts = s.points;
        const endP = pts[pts.length - 1];
        if (!endP) return;

        const dist = Math.hypot(mouseX - endP.x, mouseY - endP.y);

        if (dist < 60) {
            s.isDragging = true;
            setIsDragging(true);
            s.dragOffset = { x: mouseX - endP.x, y: mouseY - endP.y };
            s.mouse = { x: mouseX, y: mouseY };
            s.dragStartY = endP.y; // Save Y at start of drag
            s.dragStartX = endP.x; // Save X
        }
    };

    const handleMouseMove = (e) => {
        if (!state.current.isDragging) return;
        const rect = canvasRef.current.getBoundingClientRect();
        state.current.mouse = {
            x: e.clientX - rect.left,
            y: e.clientY - rect.top
        };
    };

    const handleMouseUp = (e) => {
        const s = state.current;
        if (s.isDragging) {
            const endP = s.points[s.points.length - 1];

            // 1. Check for Drag-to-Toggle (Pull down significantly)
            const pullDist = endP.y - s.dragStartY;

            // 2. Check for Click-to-Toggle (Small movement)
            const rect = canvasRef.current.getBoundingClientRect();
            const mouseX = e.clientX - rect.left;
            const mouseY = e.clientY - rect.top;
            const moveDist = Math.hypot(mouseX - (s.dragStartX + s.dragOffset.x), mouseY - (s.dragStartY + s.dragOffset.y));

            s.isDragging = false;
            setIsDragging(false);

            if (!readOnly) {
                // Toggle on significant pull OR a simple click
                if (pullDist > 60 || moveDist < 10) {
                    if (onToggle) onToggle();
                }
            }
        }
    };

    return (
        <div style={{
            pointerEvents: 'none',
            position: 'relative'
        }}>

            <canvas
                ref={canvasRef}
                width={150}
                height={800}
                style={{
                    pointerEvents: (isDragging || isNearRope) ? 'auto' : 'none',
                    cursor: isDragging ? 'grabbing' : 'grab',
                    touchAction: 'none',
                    display: 'block'
                }}
                onMouseDown={handleMouseDown}
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUp}
                onMouseLeave={handleMouseUp}
            />
        </div>
    );
}
