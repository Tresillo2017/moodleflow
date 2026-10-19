import { IconBolt, IconBlocks, IconBrandGithub, IconBrush, IconDownload, IconDroplet, IconFileText, IconKeyboard, IconLayout2, IconProgressCheck, IconSettings, IconSnowflake } from "@tabler/icons-react";
import { Brand } from "./_components/brand/brand";
import { Card, Content, SideLeft, SideRight } from "./_components/content/content";
import { Feature, FeatureIcon, FeatureList } from "./_components/feature/feature";
import { Hero } from "./_components/hero/hero";
import { Section } from "./_components/section/section";
import { Button, ButtonRow } from "./_components/button/button";
import { BrowserButton } from "./_components/button/browser_button";
import { Image } from "./_components/image/image";
import { Slides } from "./_components/slides/slides";
import { InstallWizard } from "./_components/wizard/wizard";
import { Notice } from "./_components/notice/notice";

const REPO = "https://github.com/Tresillo2017/moodleflow";

export default function Home() {
	return (
		<>
			<Content outer>
				<Notice>
					<InstallWizard>
						<Button primary>
							<IconDownload size={18} />
							<BrowserButton />
						</Button>
					</InstallWizard>
				</Notice>
			</Content>
			<Hero>
				<Content column={false} outer>
					<SideLeft>
						<Content>
							<Brand />
							<h1 className="brand">Moodle, viewed<br />from a new lens</h1>
							<h3 style={{ maxWidth: 400 }}>A fresh coat of paint for Moodle, bringing you closer to the courses that matter. Themes, glass and motion, straight from bleh.</h3>
							<ButtonRow>
								<InstallWizard>
									<Button primary>
										<IconDownload size={18} />
										<BrowserButton />
									</Button>
								</InstallWizard>
								<Button link={REPO} primary colourful>
									<IconBrandGithub size={18} />
									GitHub
								</Button>
							</ButtonRow>
						</Content>
					</SideLeft>
					<SideRight span>
						<Content>
							<div className="banner">
								<img src={"/shots/hero.webp"} alt="moodleflow on a Moodle course page" />
							</div>
						</Content>
					</SideRight>
				</Content>
			</Hero>
			<Section alternate>
				<Content column={false} outer>
					<SideLeft span>
						<Content>
							<Slides images={[
								{
									src: '/shots/themes.webp',
									alt: 'Themes from the brightest to the darkest'
								},
								{
									src: '/shots/accent.webp',
									alt: 'Accent colours that follow the course image'
								},
								{
									src: '/shots/sidebar.webp',
									alt: 'A redesigned course sidebar and in-course navigation'
								},
								{
									src: '/shots/settings.webp',
									alt: 'One settings page for every option'
								},
								{
									src: '/shots/seasonal.webp',
									alt: 'Seasonal effects that come and go with the calendar'
								},
								{
									src: '/shots/switcher.webp',
									alt: 'Quick switcher with Ctrl or Cmd plus K'
								}
							]} />
						</Content>
					</SideLeft>
					<SideRight>
						<Content>
							<FeatureList>
								<Feature icon={IconDroplet} title="Choose your style">
									Enjoy a range of themes from the <em>brightest to the darkest</em>.<br />Pick an <em>accent colour</em> from presets, or let it follow the <em>course image</em> and fine-tune it to suit you.
								</Feature>
								<Feature icon={IconLayout2} title="Courses come first">
									The course sidebar and in-course navigation have been <em>redesigned</em>, so the page you need is never more than a click away.
								</Feature>
								<Feature icon={IconKeyboard} title="Quick switcher">
									Press <em>Ctrl or ⌘ + K</em> to jump to any course, page or setting without hunting through menus.
								</Feature>
								<Feature icon={IconProgressCheck} title="Stays up to date">
									Update notifications tell you when a <em>new release</em> is out, so the script never quietly falls behind.
								</Feature>
							</FeatureList>
						</Content>
					</SideRight>
				</Content>
			</Section>
			<Section>
				<Card>
					<Content column={false} outer>
						<SideLeft>
							<Content>
								<FeatureIcon icon={IconDroplet} large />
								<h2>Glass, blur and motion</h2>
								<p>Solarium glass, card vibrancy and a <em>blurred course image</em> sit behind everything, so pages feel layered rather than flat.<br /><em>Reduced motion</em> is one switch away, and it follows your operating system.</p>
							</Content>
						</SideLeft>
						<SideRight span>
							<Content>
								<Image src={'/shots/glass.webp'} alt="Glass, blur and motion" shrink round />
							</Content>
						</SideRight>
					</Content>
				</Card>
			</Section>
			<Section>
				<Card>
					<Content column={false} outer>
						<SideLeft span>
							<Content>
								<Image src={'/shots/preview.webp'} alt="Preview course files in place" shrink round />
							</Content>
						</SideLeft>
						<SideRight>
							<Content>
								<FeatureIcon icon={IconFileText} large />
								<h2>Open files in place</h2>
								<p>Preview a course file <em>right where it was posted</em>, so you can read the handout you were sent without downloading it and opening a new tab.</p>
							</Content>
						</SideRight>
					</Content>
				</Card>
			</Section>
			<Section>
				<Card>
					<Content column={false} outer>
						<SideLeft>
							<Content>
								<FeatureIcon icon={IconSettings} large />
								<h2>Every option in one place</h2>
								<p>Themes, accessibility, seasonal effects and the rest live on <em>one settings page</em>, opened in place from your account menu.<br />Import, export or reset your settings whenever you like.</p>
							</Content>
						</SideLeft>
						<SideRight span>
							<Content>
								<Image src={'/shots/settings.webp'} alt="Every option in one place" shrink round />
							</Content>
						</SideRight>
					</Content>
				</Card>
			</Section>
			<Section>
				<Card>
					<Content column={false} outer>
						<SideLeft span>
							<Content>
								<Image src={'/shots/performance.webp'} alt="Light on your browser" shrink round />
							</Content>
						</SideLeft>
						<SideRight>
							<Content>
								<FeatureIcon icon={IconBolt} large />
								<h2>Light on your browser</h2>
								<p>The stylesheet leaves out bleh&apos;s Last.fm-only parts, and big decorations load <em>only when a season or theme needs them</em>.<br />Your pages stay as quick as Moodle intends them to be.</p>
							</Content>
						</SideRight>
					</Content>
				</Card>
			</Section>
			<Section alternate>
				<Content column={false} outer>
					<SideLeft span>
						<Content>
							<h2>Built to be tweaked</h2>
							<FeatureList>
								<Feature icon={IconSnowflake} title="Seasons, on schedule">
									Seasonal themes re-tint the page and drop snow or leaves on their dates, with <em>particle level</em> and a <em>performance mode</em> if you want them quieter.
								</Feature>
								<Feature icon={IconBrush} title="Your fonts">
									Choose a stylised, simple or hyperlegible font set, with serif and emoji options and <em>three weights</em>, or bring your own.
								</Feature>
								<Feature icon={IconBlocks} title="Works with your site">
									The script runs on the Moodle sites in its <em>@match</em> line. Add your school&apos;s address to the <em>@match</em> line and it works there too.
								</Feature>
								<Feature icon={IconBrandGithub} title="Open source">
									moodleflow is a <em>GPL-3.0</em> port of bleh by katelyn. Issues, ideas and pull requests are welcome on GitHub.
								</Feature>
							</FeatureList>
						</Content>
					</SideLeft>
					<SideRight>
						<Content>
							<Image src={'/shots/fonts.webp'} alt="Your fonts" shrink round />
						</Content>
					</SideRight>
				</Content>
			</Section>
			<Section>
				<Content outer>
					<Brand />
					<h2>Looking interesting?</h2>
					<ButtonRow>
						<InstallWizard>
							<Button primary>
								<IconDownload size={18} />
								<BrowserButton />
							</Button>
						</InstallWizard>
						<Button link={REPO} primary colourful>
							<IconBrandGithub size={18} />
							GitHub
						</Button>
					</ButtonRow>
				</Content>
			</Section>
		</>
	)
}
