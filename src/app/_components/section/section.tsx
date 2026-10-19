import styles from "./section.module.css";
import React from "react";

interface SectionProps {
    alternate?: boolean,
    children: React.ReactNode
}

export function Section({
    alternate = false,
    children
}: SectionProps) {
    return (
        <section className={`${styles.section} ${alternate ? styles.alternate : ''}`}>
            {children}
        </section>
    )
}
