import ankle from "./assets/team-logos/ankle.png";
import bigDicks from "./assets/team-logos/big-dicks.png";
import contenderinski from "./assets/team-logos/contenderinski.png";
import falirofornia from "./assets/team-logos/falirofornia.png";
import klarinman from "./assets/team-logos/klarinman.png";
import leklaps from "./assets/team-logos/leklaps.png";
import lemoukarie from "./assets/team-logos/lemoukarie.png";
import mental from "./assets/team-logos/mental.png";
import poutsobanana from "./assets/team-logos/poutsobanana.png";
import proodeutiki from "./assets/team-logos/proodeutiki.png";
import pww from "./assets/team-logos/pww.png";
import sideroprionoi from "./assets/team-logos/sideroprionoi.png";
import stomaola from "./assets/team-logos/stomaola.png";
import tanoulides from "./assets/team-logos/tanoulides.png";

const TEAM_LOGO_MATCH_THRESHOLD = 0.8;

const TEAM_LOGOS = [
	{ key: "ankle", label: "Ankle", src: ankle },
	{ key: "bigdicks", label: "Big Dicks", src: bigDicks },
	{ key: "contenderinski", label: "Contenderinski", src: contenderinski },
	{ key: "falirofornia", label: "Falirofornia", src: falirofornia },
	{ key: "klarinman", label: "Klarinman", src: klarinman },
	{ key: "leklaps", label: "Leklaps", src: leklaps },
	{ key: "lemoukarie", label: "LeMoukarie", src: lemoukarie },
	{ key: "mental", label: "Mental", src: mental },
	{ key: "poutsobanana", label: "Poutsobanana", src: poutsobanana },
	{ key: "proodeutiki", label: "Proodeutiki", src: proodeutiki },
	{ key: "pww", label: "P.W.W.", src: pww },
	{ key: "sideroprionoi", label: "Sideroprionoi", src: sideroprionoi },
	{ key: "stomaola", label: "StomaOla", src: stomaola },
	{ key: "tanoulides", label: "Tanoulides", src: tanoulides },
];

const normalize = (value: string) =>
	value
		.toLowerCase()
		.normalize("NFD")
		.replace(/[\u0300-\u036f]/g, "")
		.replace(/[^a-z0-9]+/g, "");

const levenshteinDistance = (a: string, b: string) => {
	const matrix = Array.from({ length: a.length + 1 }, () =>
		new Array<number>(b.length + 1).fill(0),
	);

	for (let i = 0; i <= a.length; i++) {
		matrix[i][0] = i;
	}

	for (let j = 0; j <= b.length; j++) {
		matrix[0][j] = j;
	}

	for (let i = 1; i <= a.length; i++) {
		for (let j = 1; j <= b.length; j++) {
			const cost = a[i - 1] === b[j - 1] ? 0 : 1;
			matrix[i][j] = Math.min(
				matrix[i - 1][j] + 1,
				matrix[i][j - 1] + 1,
				matrix[i - 1][j - 1] + cost,
			);
		}
	}

	return matrix[a.length][b.length];
};

const similarity = (a: string, b: string) => {
	if (a.length === 0 && b.length === 0) {
		return 1;
	}

	if (a.includes(b) || b.includes(a)) {
		return Math.min(a.length, b.length) / Math.max(a.length, b.length);
	}

	const distance = levenshteinDistance(a, b);
	return 1 - distance / Math.max(a.length, b.length);
};

export const getClosestTeamLogo = (teamName: string) => {
	const normalizedName = normalize(teamName);
	if (!normalizedName) {
		return undefined;
	}

	let bestMatch:
		| {
				key: string;
				label: string;
				src: string;
				score: number;
		  }
		| undefined;

	for (const logo of TEAM_LOGOS) {
		const score = similarity(normalizedName, logo.key);
		if (!bestMatch || score > bestMatch.score) {
			bestMatch = {
				...logo,
				score,
			};
		}
	}

	if (!bestMatch || bestMatch.score < TEAM_LOGO_MATCH_THRESHOLD) {
		return undefined;
	}

	return bestMatch;
};
