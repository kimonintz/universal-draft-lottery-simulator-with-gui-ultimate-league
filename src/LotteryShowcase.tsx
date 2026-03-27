import { useEffect, useMemo, useRef, useState } from "preact/hooks";
import { Button } from "./Button";
import { simLottery } from "./simLottery";
import chicagoBullsMusic from "./assets/audio/chicago-bulls-music.mp3";
import ballotBoardBackground from "./assets/nba-teams.png";
import revealDeskBackground from "./assets/nba-draft.png";
import nbaLogo from "./assets/logo-nba.png";
import silverNba from "./assets/silver-nba.png";
import { getClosestTeamLogo } from "./teamLogos";

const REVEAL_DELAY_MS = 5000;
const FINAL_REVEAL_DELAY_MS = 10000;

const ordinal = (x: number) => {
	let suffix;

	if (x % 100 >= 11 && x % 100 <= 13) {
		suffix = "th";
	} else if (x % 10 === 1) {
		suffix = "st";
	} else if (x % 10 === 2) {
		suffix = "nd";
	} else if (x % 10 === 3) {
		suffix = "rd";
	} else {
		suffix = "th";
	}

	return x.toString() + suffix;
};

const buildRevealGroups = (numTeams: number) => {
	const groups: number[][] = [];

	for (let position = numTeams - 1; position >= 3; position--) {
		groups.push([position]);
	}

	if (numTeams > 0) {
		groups.push(
			Array.from({ length: Math.min(3, numTeams) }, (_, index) => index),
		);
	}

	return groups;
};

const formatChanceShare = (chance: number, totalChance: number) => {
	if (totalChance <= 0) {
		return "0.0% share";
	}

	return `${((chance / totalChance) * 100).toFixed(1)}% share`;
};

const podiumOrder = (positions: number[]) => {
	if (positions.length === 3) {
		return [1, 0, 2];
	}

	return positions;
};

type LotteryShowcaseProps = {
	chances: number[];
	disabled: boolean;
	names: string[];
	numToPick: number;
	setLotteryResults: (results: number[] | undefined) => void;
};

export const LotteryShowcase = ({
	chances,
	disabled,
	names,
	numToPick,
	setLotteryResults,
}: LotteryShowcaseProps) => {
	const audioRef = useRef<HTMLAudioElement>();
	const [musicPlaying, setMusicPlaying] = useState(false);
	const [status, setStatus] = useState<"idle" | "running" | "complete">("idle");
	const [activeResults, setActiveResults] = useState<number[] | undefined>();
	const [revealStep, setRevealStep] = useState(-1);
	const [phase, setPhase] = useState<"reveals" | "topPickPrompt" | "topThree">(
		"reveals",
	);

	const totalChance = useMemo(
		() => chances.reduce((sum, chance) => sum + chance, 0),
		[chances],
	);
	const revealGroups = useMemo(
		() => buildRevealGroups(names.length),
		[names.length],
	);

	useEffect(() => {
		audioRef.current = new Audio(chicagoBullsMusic);
		audioRef.current.loop = true;
		audioRef.current.addEventListener("play", () => {
			setMusicPlaying(true);
		});
		audioRef.current.addEventListener("pause", () => {
			setMusicPlaying(false);
		});

		void audioRef.current.play().catch(() => {
			// Ignore autoplay failures and let the separate music control start it.
		});

		return () => {
			if (audioRef.current) {
				audioRef.current.pause();
				audioRef.current.currentTime = 0;
			}
		};
	}, []);

	useEffect(() => {
		setStatus("idle");
		setActiveResults(undefined);
		setRevealStep(-1);
		setPhase("reveals");
	}, [chances, names, numToPick]);

	useEffect(() => {
		if (status !== "running" || revealStep < 0 || !activeResults) {
			return;
		}

		const finalRevealStep = revealGroups.length - 1;
		const lastSingleRevealStep = Math.max(0, finalRevealStep - 1);
		const timeout = window.setTimeout(
			() => {
				if (phase === "reveals") {
					if (revealStep < lastSingleRevealStep) {
						setRevealStep((value) => value + 1);
					} else {
						setPhase("topPickPrompt");
					}
					return;
				}

				if (phase === "topPickPrompt") {
					setPhase("topThree");
					setRevealStep(finalRevealStep);
					setStatus("complete");
					setLotteryResults(activeResults);
				}
			},
			phase === "topPickPrompt" ? FINAL_REVEAL_DELAY_MS : REVEAL_DELAY_MS,
		);

		return () => {
			window.clearTimeout(timeout);
		};
	}, [
		activeResults,
		phase,
		revealGroups.length,
		revealStep,
		setLotteryResults,
		status,
	]);

	const currentPositions =
		status === "idle" || revealStep < 0 || phase === "topPickPrompt"
			? []
			: revealGroups[revealStep] ?? [];

	const revealedPositions = useMemo(() => {
		if (status === "idle" || revealStep < 0) {
			return [];
		}

		if (phase === "topPickPrompt") {
			return revealGroups.slice(0, revealStep + 1).flat();
		}

		return revealGroups.slice(0, revealStep + 1).flat();
	}, [phase, revealGroups, revealStep, status]);

	const revealedPickByTeam = useMemo(() => {
		const mapping = new Map<number, number>();

		if (!activeResults) {
			return mapping;
		}

		for (const position of revealedPositions) {
			mapping.set(activeResults[position], position);
		}

		return mapping;
	}, [activeResults, revealedPositions]);

	const statusMessage =
		status === "idle"
			? "Start the live reveal to announce picks from the back of the draft board up to a simultaneous top-3 finish."
			: phase === "topPickPrompt"
			? "AND THE TOP PICK GOES TO..."
			: currentPositions.length > 1
			? "The last envelopes are open. The top 3 are now on stage together."
			: `${ordinal(currentPositions[0] + 1)} pick is being announced.`;

	const startLottery = () => {
		if (disabled || names.length === 0) {
			return;
		}

		const results = simLottery(chances, numToPick);
		setLotteryResults(undefined);
		setActiveResults(results);
		setRevealStep(0);
		setPhase("reveals");
		setStatus("running");
	};

	const resetShowcase = () => {
		setStatus("idle");
		setActiveResults(undefined);
		setRevealStep(-1);
		setPhase("reveals");
		setLotteryResults(undefined);
	};

	const toggleMusic = () => {
		if (!audioRef.current) {
			return;
		}

		if (audioRef.current.paused) {
			void audioRef.current.play().catch(() => {
				// Ignore playback failures caused by browser autoplay restrictions.
			});
		} else {
			audioRef.current.pause();
		}
	};

	return (
		<section className="lottery-stage">
			<div className="lottery-stage__arenaGlow" />
			<div className="lottery-stage__brandBar">
				<div className="lottery-stage__leagueMark">
					<img
						className="lottery-stage__leagueLogo"
						src={nbaLogo}
						alt="NBA logo"
					/>
					<div>
						<div className="lottery-stage__leagueLabel">
							NBA Style Draft Night
						</div>
						<div className="lottery-stage__leagueSubLabel">
							Lottery broadcast presentation
						</div>
					</div>
				</div>
			</div>

			<div className="lottery-stage__header">
				<div>
					<div className="lottery-stage__eyebrow">Commissioner Reveal Mode</div>
					<h2 className="lottery-stage__title">Lottery Reveal Show</h2>
					<p className="lottery-stage__subtitle">
						{names.length} teams, {numToPick} lottery selections.{" "}
						{statusMessage}
					</p>
				</div>

				<div className="lottery-stage__actions">
					<Button
						variant="primary"
						outline
						onClick={toggleMusic}
						disabled={false}
					>
						{musicPlaying ? "Pause Music" : "Play Music"}
					</Button>
					<Button
						variant="success"
						onClick={startLottery}
						disabled={disabled || names.length === 0}
						className="ml-2"
					>
						{status === "idle" ? "Start Lottery" : "Run Again"}
					</Button>
					{status !== "idle" ? (
						<Button
							variant="danger"
							outline
							className="ml-2"
							onClick={resetShowcase}
							disabled={disabled}
						>
							Reset Board
						</Button>
					) : null}
				</div>
			</div>

			<div className="lottery-stage__grid">
				<div
					className="lottery-stage__panel lottery-stage__panel--ballot"
					style={
						{
							"--panel-bg-image": `url(${ballotBoardBackground})`,
						} as any
					}
				>
					<div className="lottery-stage__panelTitle">Ballot Board</div>
					<div className="lottery-stage__ballotGrid">
						{names.map((name, teamIndex) => {
							const revealedPick = revealedPickByTeam.get(teamIndex);
							const isActive = currentPositions.some(
								(position) => activeResults?.[position] === teamIndex,
							);
							const isRevealed = revealedPick !== undefined;
							const share =
								totalChance > 0 ? (chances[teamIndex] / totalChance) * 100 : 0;
							const matchedLogo = getClosestTeamLogo(name);

							return (
								<div
									className={`lottery-ballot-card ${
										isActive
											? "lottery-ballot-card--active"
											: isRevealed
											? "lottery-ballot-card--revealed"
											: ""
									}`}
									key={`${teamIndex}-${name}`}
								>
									<div className="lottery-ballot-card__seed">
										#{teamIndex + 1}
									</div>
									{matchedLogo ? (
										<img
											className="lottery-ballot-card__logo"
											src={matchedLogo.src}
											alt={`${matchedLogo.label} logo`}
										/>
									) : null}
									<div className="lottery-ballot-card__content">
										<div className="lottery-ballot-card__headerRow">
											<div className="lottery-ballot-card__name">
												{name || "Unnamed Team"}
											</div>
											<div className="lottery-ballot-card__badge">
												{isActive
													? "On stage"
													: isRevealed
													? `${ordinal(revealedPick + 1)} pick`
													: "Waiting"}
											</div>
										</div>
										<div className="lottery-ballot-card__meta">
											<span>{chances[teamIndex].toLocaleString()} odds</span>
											<span>
												{formatChanceShare(chances[teamIndex], totalChance)}
											</span>
										</div>
										<div className="lottery-ballot-card__track">
											<div
												className="lottery-ballot-card__fill"
												style={{ width: `${Math.max(share, 4)}%` }}
											/>
										</div>
									</div>
								</div>
							);
						})}
					</div>
				</div>

				<div
					className="lottery-stage__panel lottery-stage__panel--spotlight"
					style={
						{
							"--panel-bg-image": `url(${revealDeskBackground})`,
						} as any
					}
				>
					<div className="lottery-stage__panelTitle">Reveal Desk</div>

					{activeResults && phase === "topPickPrompt" ? (
						<div className="lottery-stage__headline">
							<div className="lottery-stage__headlineEyebrow">
								Final envelope on the podium
							</div>
							<div className="lottery-stage__headlineText">
								AND THE TOP PICK GOES TO...
							</div>
							<div className="lottery-stage__headlineSubtext">
								The top 3 will be revealed together in 10 seconds.
							</div>
						</div>
					) : activeResults && currentPositions.length > 0 ? (
						currentPositions.length === 1 ? (
							<div className="lottery-stage__spotlight">
								<div className="lottery-stage__spotlightLabel">
									Now revealing the {ordinal(currentPositions[0] + 1)} pick
								</div>
								<div className="lottery-stage__spotlightName">
									{names[activeResults[currentPositions[0]]]}
								</div>
								<div className="lottery-stage__spotlightOdds">
									{formatChanceShare(
										chances[activeResults[currentPositions[0]]],
										totalChance,
									)}
								</div>
							</div>
						) : (
							<div className="lottery-stage__podium">
								{podiumOrder(currentPositions).map((position) => {
									const teamIndex = activeResults[position];
									return (
										<div
											className={`lottery-podium-card ${
												position === 0 ? "lottery-podium-card--champion" : ""
											}`}
											key={position}
										>
											<div className="lottery-podium-card__pick">
												{ordinal(position + 1)}
											</div>
											<div className="lottery-podium-card__name">
												{names[teamIndex]}
											</div>
											<div className="lottery-podium-card__odds">
												{formatChanceShare(chances[teamIndex], totalChance)}
											</div>
										</div>
									);
								})}
							</div>
						)
					) : (
						<div className="lottery-stage__placeholder">
							<img
								className="lottery-stage__placeholderBall"
								src={silverNba}
								alt="NBA commissioner"
							/>
							<div className="lottery-stage__placeholderTitle">
								Awaiting the draw
							</div>
							<p className="lottery-stage__placeholderText">
								Press Start Lottery to animate the reveal from the 14th pick up
								to the final three.
							</p>
						</div>
					)}

					<div className="lottery-stage__pickBoard">
						{Array.from({ length: names.length }, (_, position) => {
							const teamIndex = activeResults?.[position];
							const isRevealed = revealedPositions.includes(position);
							const isCurrent =
								phase !== "topPickPrompt" &&
								currentPositions.includes(position);

							return (
								<div
									className={`lottery-pick-card ${
										isCurrent
											? "lottery-pick-card--active"
											: isRevealed
											? "lottery-pick-card--revealed"
											: ""
									}`}
									key={position}
								>
									<div className="lottery-pick-card__label">
										{ordinal(position + 1)}
									</div>
									<div className="lottery-pick-card__team">
										{isRevealed && teamIndex !== undefined
											? names[teamIndex]
											: "Awaiting reveal"}
									</div>
								</div>
							);
						})}
					</div>
				</div>
			</div>
		</section>
	);
};
