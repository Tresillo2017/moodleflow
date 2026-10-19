import { TablerIcon } from "@tabler/icons-react";
import styles from "./feature.module.css";
import React, { ForwardRefExoticComponent, RefAttributes } from "react";
import { IconProps } from "@mingcute/react";

interface FeatureProps {
	icon: TablerIcon,
	title: string,
	children: React.ReactNode
}

export function Feature({
	icon,
	title,
	children
}: FeatureProps) {
	return (
		<div className={styles.feature}>
			<FeatureIcon icon={icon} />
			<div className={styles.body}>
				<strong className={styles.title}>{title}</strong>
				<p className={styles.content}>{children}</p>
			</div>
		</div>
	)
}

interface FeatureListProps {
	children: React.ReactNode
}

export function FeatureList({
	children
}: FeatureListProps) {
	return (
		<div className={styles.list}>
			{children}
		</div>
	)
}

interface FeatureIconProps {
	large?: boolean,
	icon: TablerIcon | ForwardRefExoticComponent<IconProps & RefAttributes<SVGSVGElement>>
}

export function FeatureIcon({
	large = false,
	icon: Icon
}: FeatureIconProps) {
	return (
		<div className={`${styles.icon} ${large ? styles.icon_large : ''}`}>
			<Icon size={large ? 24 : 20} />
		</div>
	)
}
