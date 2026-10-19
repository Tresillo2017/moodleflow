import styles from "./content.module.css";
import React from "react";

interface ContentProps {
    outer?: boolean,
    column?: boolean,
    children: React.ReactNode
}

export function Content({
    outer = false,
    column = true,
    children
}: ContentProps) {
    return (
        <section className={`${styles.content} ${column ? styles.col : ''} ${outer ? styles.outer : ''}`}>
            {children}
        </section>
    )
}

interface SideProps {
    span?: boolean,
    children: React.ReactNode
}

export function SideLeft({
    span = false,
    children
}: SideProps) {
    return (
        <div className={`${styles.side} ${styles.left} ${span ? styles.span : ''}`}>
            {children}
        </div>
    )
}

export function SideRight({
    span = false,
    children
}: SideProps) {
    return (
        <div className={`${styles.side} ${styles.right} ${span ? styles.span : ''}`}>
            {children}
        </div>
    )
}

interface CardProps {
    children: React.ReactNode
}

export function Card({
    children
}: CardProps) {
    return (
        <div className={styles.card}>
            {children}
        </div>
    )
}
