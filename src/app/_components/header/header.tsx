import { Brand } from "../brand/brand";
import styles from "./header.module.css";
import React from "react";

export function Header() {
    return (
        <section className={styles.header}>
            <Brand />
        </section>
    )
}
