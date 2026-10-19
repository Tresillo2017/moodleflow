"use client";

import styles from "./button.module.css";
import React, { ComponentPropsWithoutRef, forwardRef } from "react";

type ButtonProps = {
    sponsor?: boolean,
    discord?: boolean,
    colourful?: boolean,
    link?: string,
    primary?: boolean,
    children: React.ReactNode
} & ComponentPropsWithoutRef<"button"> &
  ComponentPropsWithoutRef<"a">

export const Button = forwardRef<
    HTMLButtonElement | HTMLAnchorElement,
    ButtonProps
>(function Button({
    sponsor,
    discord,
    colourful,
    link,
    primary = false,
    children,
    ...props
}, ref) {
    if (link) {
        return (
            <a className={`${styles.button} ${primary ? styles.primary : ''} ${colourful ? 'colourful' : ''} ${sponsor ? styles.sponsor : ''} ${discord ? styles.discord : ''}`} ref={ref as React.Ref<HTMLAnchorElement>} href={link} target="_blank" {...props}>
                {children}
            </a>
        )
    }

    return (
        <button className={`${styles.button} ${primary ? styles.primary : ''} ${colourful ? 'colourful' : ''} ${sponsor ? styles.sponsor : ''}`} ref={ref as React.Ref<HTMLButtonElement>} type="button" {...props}>
            {children}
        </button>
    )
})

interface ButtonRowProps {
    children: React.ReactNode
}

export function ButtonRow({
    children
}: ButtonRowProps) {
    return (
        <div className={styles.row}>
            {children}
        </div>
    )
}
