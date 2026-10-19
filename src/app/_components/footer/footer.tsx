import styles from "./footer.module.css";
import React from "react";

export function Footer() {
    return (
        <section className={styles.footer}>
            <span>
                moodleflow is a Moodle port of <a href="https://github.com/katelyynn/bleh" target="_blank">bleh</a> by katelyn, GPL-3.0-or-later.
            </span>
            <span>
                Site adapted from <a href="https://github.com/katelyynn/bleh-www" target="_blank">bleh-www</a> · <a href="https://github.com/Tresillo2017/moodleflow" target="_blank">source on GitHub</a> · <a href="https://github.com/Tresillo2017/moodleflow/blob/master/LICENSE" target="_blank">license</a>
            </span>
        </section>
    )
}
