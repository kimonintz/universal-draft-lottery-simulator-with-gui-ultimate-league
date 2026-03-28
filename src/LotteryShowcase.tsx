import {
	useEffect,
	useLayoutEffect,
	useMemo,
	useRef,
	useState,
} from "preact/hooks";
import { Button } from "./Button";
import { simLottery } from "./simLottery";
import chicagoBullsMusic from "./assets/audio/chicago-bulls-music.mp3";
import heartbeatSfx from "./assets/audio/heartbeat.mp3";
import championsMusic from "./assets/audio/we-are-the-champions.mp3";
import ballotBoardBackground from "./assets/nba-teams.png";
import revealDeskBackground from "./assets/nba-draft.png";
import nbaLogo from "./assets/logo-nba.svg";
import silverNba from "./assets/silver-nba.png";
import fireworksVideo from "./assets/fireworks-loop.mp4";
import { getClosestTeamLogo } from "./teamLogos";

const INITIAL_DELAY_MS = 5000;
const REVEAL_DELAY_MS = 10000;
const NAME_REVEAL_DELAY_MS = 5000;
const FINAL_REVEAL_DELAY_MS = 10000;
const FADE_OUT_DURATION_MS = 4000;

const fadeOutAudio = (
	el: HTMLAudioElement,
	durationMs: number,
	onDone?: () => void,
) => {
	const startVolume = el.volume;
	const steps = 30;
	const stepMs = durationMs / steps;
	const stepSize = startVolume / steps;
	let step = 0;

	const interval = window.setInterval(() => {
		step++;
		el.volume = Math.max(0, startVolume - step * stepSize);
		if (step >= steps) {
			clearInterval(interval);
			el.pause();
			el.volume = startVolume;
			onDone?.();
		}
	}, stepMs);
};

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
	const heartbeatRef = useRef<HTMLAudioElement>();
	const heartbeatCtxRef = useRef<AudioContext>();
	const championsRef = useRef<HTMLAudioElement>();

	const [status, setStatus] = useState<"idle" | "running" | "complete">("idle");
	const [activeResults, setActiveResults] = useState<number[] | undefined>();
	const [revealStep, setRevealStep] = useState(-1);
	const [phase, setPhase] = useState<
		"waiting" | "reveals" | "topPickPrompt" | "topThree"
	>("waiting");
	const [draftSeason, setDraftSeason] = useState(() => {
		const y = new Date().getFullYear();
		return `${y}-${String(y + 1).slice(2)}`;
	});
	const [countdown, setCountdown] = useState<number | null>(null);
	const [nameVisible, setNameVisible] = useState(false);
	const [championsDuration, setChampionsDuration] = useState(30);

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
		audioRef.current.currentTime = 8;

		heartbeatRef.current = new Audio(heartbeatSfx);
		heartbeatRef.current.loop = true;

		championsRef.current = new Audio(championsMusic);
		championsRef.current.loop = false;
		championsRef.current.addEventListener("loadedmetadata", () => {
			if (championsRef.current) {
				setChampionsDuration(championsRef.current.duration);
			}
		});

		// Try autoplay immediately; if the browser blocks it, start on first user gesture.
		void audioRef.current.play().catch(() => {
			const unlockAudio = () => {
				if (!audioRef.current || !audioRef.current.paused) {
					return;
				}
				void audioRef.current.play().catch(() => {});
				document.removeEventListener("click", unlockAudio);
				document.removeEventListener("keydown", unlockAudio);
			};
			document.addEventListener("click", unlockAudio);
			document.addEventListener("keydown", unlockAudio);
		});

		return () => {
			[audioRef, heartbeatRef, championsRef].forEach((ref) => {
				if (ref.current) {
					ref.current.pause();
					ref.current.currentTime = 0;
				}
			});
			void heartbeatCtxRef.current?.close();
		};
	}, []);

	useEffect(() => {
		setStatus("idle");
		setActiveResults(undefined);
		setRevealStep(-1);
		setPhase("waiting");
	}, [chances, names, numToPick]);

	useEffect(() => {
		if (phase === "topPickPrompt") {
			// Fade out Bulls music then start heartbeat
			const startHeartbeat = () => {
				if (!heartbeatRef.current) {
					return;
				}

				if (!heartbeatCtxRef.current) {
					try {
						const ctx = new AudioContext();
						const source = ctx.createMediaElementSource(heartbeatRef.current);
						const gain = ctx.createGain();
						gain.gain.value = 1;
						source.connect(gain);
						gain.connect(ctx.destination);
						heartbeatCtxRef.current = ctx;
					} catch {
						heartbeatRef.current.volume = 1.0;
					}
				}

				void heartbeatCtxRef.current?.resume();
				heartbeatRef.current.currentTime = 8;
				void heartbeatRef.current.play().catch(() => {});
			};

			if (audioRef.current && !audioRef.current.paused) {
				fadeOutAudio(audioRef.current, FADE_OUT_DURATION_MS, startHeartbeat);
			} else {
				startHeartbeat();
			}
		} else if (phase === "topThree") {
			// Stop heartbeat, play Champions
			if (heartbeatRef.current) {
				heartbeatRef.current.pause();
				heartbeatRef.current.currentTime = 0;
			}
			if (championsRef.current) {
				championsRef.current.currentTime = 0;
				void championsRef.current.play().catch(() => {});
			}
		}
	}, [phase]);

	useEffect(() => {
		if (status !== "running" || phase !== "waiting") {
			return;
		}

		const totalSeconds = INITIAL_DELAY_MS / 1000;
		setCountdown(totalSeconds);

		const interval = window.setInterval(() => {
			setCountdown((prev) => {
				if (prev === null || prev <= 1) {
					clearInterval(interval);
					return null;
				}
				return prev - 1;
			});
		}, 1000);

		return () => window.clearInterval(interval);
	}, [status, phase]);

	// Reset synchronously before the browser paints to avoid a one-frame flash
	// where the previous step's nameVisible=true leaks into the new step.
	useLayoutEffect(() => {
		if (status !== "running" || phase !== "reveals") {
			return;
		}
		setNameVisible(false);
	}, [revealStep, phase, status]);

	useEffect(() => {
		if (status !== "running" || phase !== "reveals") {
			return;
		}
		const t = window.setTimeout(
			() => setNameVisible(true),
			NAME_REVEAL_DELAY_MS,
		);
		return () => window.clearTimeout(t);
	}, [revealStep, phase, status]);

	useEffect(() => {
		if (status !== "running" || !activeResults) {
			return;
		}

		const finalRevealStep = revealGroups.length - 1;
		const lastSingleRevealStep = Math.max(0, finalRevealStep - 1);

		if (phase === "waiting") {
			const timeout = window.setTimeout(() => {
				setPhase("reveals");
				setRevealStep(0);
			}, INITIAL_DELAY_MS);
			return () => window.clearTimeout(timeout);
		}

		if (revealStep < 0) {
			return;
		}

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
		status === "idle" ||
		revealStep < 0 ||
		phase === "waiting" ||
		phase === "topPickPrompt"
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
			: phase === "waiting"
			? "Get ready..."
			: phase === "topPickPrompt"
			? "AND THE TOP PICK GOES TO..."
			: currentPositions.length > 1
			? `Congratulations ${
					activeResults ? names[activeResults[0]] : ""
			  }! Have a great season managers!`
			: currentPositions.length === 1
			? `${ordinal(currentPositions[0] + 1)} pick is being announced.`
			: "Get ready...";

	const startLottery = () => {
		if (disabled || names.length === 0) {
			return;
		}

		const results = simLottery(chances, numToPick);
		const currentYear = new Date().getFullYear();
		setDraftSeason(`${currentYear}-${String(currentYear + 1).slice(2)}`);
		setLotteryResults(undefined);
		setActiveResults(results);
		setRevealStep(-1);
		setPhase("waiting");
		setStatus("running");
	};

	const resetShowcase = () => {
		[heartbeatRef, championsRef].forEach((ref) => {
			if (ref.current) {
				ref.current.pause();
				ref.current.currentTime = 0;
			}
		});
		setStatus("idle");
		setActiveResults(undefined);
		setRevealStep(-1);
		setPhase("waiting");
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
			{phase === "topThree" ? (
				<video
					className="lottery-stage__fireworks"
					src={fireworksVideo}
					autoPlay
					loop
					muted
					playsInline
					aria-hidden="true"
					style={{ animationDuration: `${championsDuration}s` }}
				/>
			) : null}
			<div className="lottery-stage__brandBar">
				<div className="lottery-stage__leagueMark">
					<img
						className="lottery-stage__leagueLogo"
						src={nbaLogo}
						alt="NBA logo"
					/>
					<div>
						<div className="lottery-stage__leagueLabel">
							The Ultimate League
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
					<h2 className="lottery-stage__title">
						{draftSeason} Rookie Lottery Night
					</h2>
					<p className="lottery-stage__subtitle">
						{status === "idle"
							? "14 teams, only 1 will land the top pick."
							: statusMessage}
					</p>
				</div>

				<div className="lottery-stage__actions">
					<button
						className="lottery-start-btn"
						onClick={startLottery}
						disabled={disabled || names.length === 0 || status === "running"}
						type="button"
					>
						Start Lottery
					</button>
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
							const isPending = currentPositions.some(
								(position) => activeResults?.[position] === teamIndex,
							);
							// Only highlight/reveal the active card once the name is shown
							const isActive = isPending && nameVisible;
							const isRevealed =
								revealedPick !== undefined && (!isPending || nameVisible);
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

					{activeResults && phase === "waiting" ? (
						<div className="lottery-stage__countdown">
							<div className="lottery-stage__countdownEyebrow">
								Get ready...
							</div>
							<div className="lottery-stage__countdownNumber" key={countdown}>
								{countdown}
							</div>
						</div>
					) : activeResults && phase === "topPickPrompt" ? (
						<div className="lottery-stage__spotlight" key="top-pick-prompt">
							<div className="lottery-stage__spotlightLabel lottery-stage__spotlightLabel--big">
								The 1st pick goes to...
							</div>
						</div>
					) : activeResults && currentPositions.length > 0 ? (
						currentPositions.length === 1 ? (
							<div
								className="lottery-stage__spotlight"
								key={`spotlight-${currentPositions[0]}`}
							>
								<div
									className={`lottery-stage__spotlightLabel${
										nameVisible ? "" : " lottery-stage__spotlightLabel--big"
									}`}
								>
									The {ordinal(currentPositions[0] + 1)} pick goes to
								</div>
								{nameVisible ? (
									<>
										<div className="lottery-stage__spotlightName">
											{names[activeResults[currentPositions[0]]]}
										</div>
										<div className="lottery-stage__spotlightOdds">
											{formatChanceShare(
												chances[activeResults[currentPositions[0]]],
												totalChance,
											)}
										</div>
									</>
								) : null}
							</div>
						) : (
							<div className="lottery-stage__podium" key="podium-reveal">
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
								Press Start Lottery to animate the reveal.
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
										{isRevealed &&
										teamIndex !== undefined &&
										(!isCurrent || nameVisible)
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
