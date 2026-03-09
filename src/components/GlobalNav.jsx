import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import RamadanStatus from './RamadanStatus';
import ThemeToggle from './ThemeToggle';
import UserAvatar from './UserAvatar';
import ProCountdownBadge from './ProCountdownBadge';


export default function GlobalNav({ className = "global-nav", backTo, backLabel }) {
    const location = useLocation();
    const isHome = location.pathname === '/';

    return (
        <nav className={className}>
            <div className="global-nav-left">
                {(!isHome || backTo) && (
                    <Link to={backTo || "/"} className="back-link">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M15 18l-6-6 6-6" />
                        </svg>
                        <span>{backLabel || "Ana Sayfa"}</span>
                    </Link>
                )}
            </div>

            <div className="global-nav-right">
                <ProCountdownBadge />
                <RamadanStatus />
                <ThemeToggle />
                <UserAvatar size={36} />
            </div>
        </nav>
    );
}
