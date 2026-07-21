import {
  computeFillPercentage,
  formatLiters,
  getFillColor,
  FILL_COLOR_HEX,
  TYPE_HUILE_LABELS,
} from "../lib/cuveDisplay";
import type { Cuve } from "../types/cuve";

interface TankGaugeProps {
  cuve: Cuve;
}

const TANK_WIDTH = 110;
const TANK_HEIGHT = 160;
const TANK_PADDING = 4;
const TANK_RADIUS = 12;

export default function TankGauge({ cuve }: TankGaugeProps) {
  const percentage = computeFillPercentage(cuve.niveau_actuel, cuve.capacite_max);
  const color = getFillColor(percentage);
  const innerHeight = TANK_HEIGHT - TANK_PADDING * 2;
  const innerWidth = TANK_WIDTH - TANK_PADDING * 2;
  const fillHeight = (percentage / 100) * innerHeight;
  const clipId = `tank-clip-${cuve.id}`;

  const label =
    `Cuve ${cuve.nom_reference}, ${TYPE_HUILE_LABELS[cuve.type_huile]}, ` +
    `remplie à ${Math.round(percentage)} % ` +
    `(${formatLiters(cuve.niveau_actuel)} sur ${formatLiters(cuve.capacite_max)})`;

  return (
    <div className="flex flex-col items-center" role="img" aria-label={label}>
      <svg
        width={TANK_WIDTH}
        height={TANK_HEIGHT}
        viewBox={`0 0 ${TANK_WIDTH} ${TANK_HEIGHT}`}
        aria-hidden="true"
      >
        <defs>
          <clipPath id={clipId}>
            <rect
              x={TANK_PADDING}
              y={TANK_PADDING}
              width={innerWidth}
              height={innerHeight}
              rx={TANK_RADIUS}
            />
          </clipPath>
        </defs>

        <rect
          x={TANK_PADDING}
          y={TANK_PADDING}
          width={innerWidth}
          height={innerHeight}
          rx={TANK_RADIUS}
          fill="white"
          stroke="#D1D5DB"
          strokeWidth="2"
        />

        <rect
          x={TANK_PADDING}
          y={TANK_PADDING + innerHeight - fillHeight}
          width={innerWidth}
          height={fillHeight}
          fill={FILL_COLOR_HEX[color]}
          clipPath={`url(#${clipId})`}
          style={{ transition: "y 500ms ease-out, height 500ms ease-out" }}
        />

        <text
          x={TANK_WIDTH / 2}
          y={TANK_HEIGHT / 2 + 7}
          textAnchor="middle"
          fontSize="22"
          fontWeight="bold"
          fill={percentage > 50 ? "white" : "#1B4332"}
        >
          {Math.round(percentage)}%
        </text>
      </svg>

      <div className="text-center mt-2 max-w-[130px]">
        <p className="font-bold text-gray-900 truncate">{cuve.nom_reference}</p>
        <p className="text-xs text-gray-500">{TYPE_HUILE_LABELS[cuve.type_huile]}</p>
        <p className="text-sm text-gray-700 font-mono">
          {formatLiters(cuve.niveau_actuel)} / {formatLiters(cuve.capacite_max)}
        </p>
      </div>
    </div>
  );
}
