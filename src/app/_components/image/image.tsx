import styles from "./image.module.css";
import React from "react";

interface ImageProps {
    round?: boolean,
    shrink?: boolean,
    src: string,
    alt: string
}

export function Image({
    round = false,
    shrink = false,
    src,
    alt
}: ImageProps) {
    return (
        <div className={`${styles.image} ${shrink ? styles.shrink: ''} ${round ? styles.round : ''}`}>
            <img src={src} alt={alt} />
        </div>
    )
}

interface ImageRowProps {
    children: React.ReactNode
}

export function ImageRow({
    children
}: ImageRowProps) {
    return (
        <div className={styles.row}>
            {children}
        </div>
    )
}
