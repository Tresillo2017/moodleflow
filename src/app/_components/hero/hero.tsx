import styles from "./hero.module.css";
import React from "react";

interface HeroProps {
    children: React.ReactNode
}

export function Hero({
    children
}: HeroProps) {
    return (
        <section className={styles.hero}>
            {children}
        </section>
    )
}
