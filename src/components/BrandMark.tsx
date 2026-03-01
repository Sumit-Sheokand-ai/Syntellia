interface BrandMarkProps {
    className?: string;
    title?: string;
}

export default function BrandMark({ className, title }: BrandMarkProps) {
    return (
        <svg
            className={className}
            width="28"
            height="28"
            viewBox="0 0 72 72"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            role="img"
            aria-hidden={title ? undefined : true}
            focusable="false"
        >
            {title ? <title>{title}</title> : null}
            <circle cx="36" cy="36" r="29" fill="#f8f8f6" />
            <circle cx="36" cy="36" r="26.5" stroke="var(--logo-accent)" strokeWidth="3.6" />
            <path
                d="M36 17.5L52 24.6V36.2C52 47.5 45.2 55.1 36 60.1C26.8 55.1 20 47.5 20 36.2V24.6L36 17.5Z"
                stroke="#111111"
                strokeWidth="2.9"
                strokeLinecap="round"
                strokeLinejoin="round"
            />
            <path
                d="M42.5 30.1C41.5 27.4 39 25.8 35.7 25.8C32.1 25.8 29.4 27.7 29.4 30.8C29.4 34 31.7 35.3 35.6 36.1C39.5 36.9 42 38.1 42 41.5C42 45.1 38.9 47.5 34.8 47.5C31.2 47.5 28.5 45.8 27.5 42.8"
                stroke="#111111"
                strokeWidth="3.2"
                strokeLinecap="round"
                strokeLinejoin="round"
            />
            <path d="M42.6 29.3L28.3 44.8" stroke="#111111" strokeWidth="3.2" strokeLinecap="round" />
        </svg>
    );
}
