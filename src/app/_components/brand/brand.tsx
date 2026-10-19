import styles from "./brand.module.css";
import React from "react";

export function Brand() {
    return (
        <h1 className={`${styles.brand} accented brand`}>
            moodleflow
        </h1>
    )
}
