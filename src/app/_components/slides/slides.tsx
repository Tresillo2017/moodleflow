"use client";

import { Slide } from "react-slideshow-image";
import styles from "./slides.module.css";
import React from "react";
import { Image } from "../image/image";
import 'react-slideshow-image/dist/styles.css';
import { Button } from "../button/button";

interface SlidesProps {
	images: Slide[]
}

interface Slide {
	src: string,
	alt: string
}

export function Slides({
	images
}: SlidesProps) {
	return (
		<div className={styles.slides}>
			<Slide autoplay={true} arrows={false} indicators={true} canSwipe={true} transitionDuration={400} duration={10000} easing="cubic" prevArrow={<Button>back</Button>} nextArrow={<Button>next</Button>} infinite>
				{images.map((image, i) => <div className={styles.slide} key={i}>
					<Image src={image.src} alt={image.alt} round />
					<p className={styles.alt}>{image.alt}</p>
				</div>)}
			</Slide>
		</div>
	)
}
