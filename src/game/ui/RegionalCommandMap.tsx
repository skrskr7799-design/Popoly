import { gameText } from '../../i18n/game';
import type { RegionalMarketState, OperatingCompanyState } from '../domain/types';

type Props = { market?: RegionalMarketState; company?: OperatingCompanyState };

export function RegionalCommandMap({ market, company }: Props) {
  const power = market?.availablePowerMW ?? 0;
  const load = market?.committedPowerMW ?? 0;
  const utilization = power > 0 ? Math.min(100, load / power * 100) : 0;
  const capacity = company?.capacity.operationalLimitMW ?? 0;
  const reliability = company?.capacity.reliability ?? 0;

  return <svg className="pop-region-map" viewBox="0 0 620 330" role="img" aria-label={gameText("Schematic of the North Region compute, energy, equipment and customer network")}>
    <defs>
      <linearGradient id="regionGlow" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#68e4ce" stopOpacity=".2"/><stop offset="1" stopColor="#5c8eff" stopOpacity=".02"/></linearGradient>
      <linearGradient id="networkLine" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stopColor="#4a9e9c" stopOpacity=".1"/><stop offset=".5" stopColor="#75e6d0" stopOpacity=".95"/><stop offset="1" stopColor="#70a6ff" stopOpacity=".25"/></linearGradient>
      <filter id="nodeGlow"><feGaussianBlur stdDeviation="5" result="blur"/><feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
      <pattern id="mapGrid" width="28" height="28" patternUnits="userSpaceOnUse"><path d="M28 0H0V28" fill="none" stroke="#9ab6c7" strokeOpacity=".08" strokeWidth="1"/></pattern>
    </defs>
    <rect width="620" height="330" fill="url(#mapGrid)"/>
    <path d="M20 235 72 191 112 205 160 145 210 157 260 96 310 118 360 69 414 88 467 42 520 66 600 24V300H20Z" fill="url(#regionGlow)" stroke="#6d9d9c" strokeOpacity=".2"/>
    <path d="M30 275 110 240 160 250 220 192 275 205 330 151 390 165 448 112 510 130 590 72" fill="none" stroke="#8daeb7" strokeOpacity=".16" strokeWidth="1.5" strokeDasharray="4 7"/>
    <g fill="none" stroke="url(#networkLine)" strokeWidth="2.2" strokeLinecap="round">
      <path d="M95 205 220 192 330 151 455 190 530 115"/>
      <path d="M220 192 250 270 455 190"/>
      <path d="M330 151 360 70 530 115"/>
      <path d="M455 190 555 255"/>
    </g>
    <g fill="none" stroke="#74e3d1" strokeOpacity=".45" strokeWidth="1.2" strokeDasharray="3 6">
      <path d="M95 205Q160 110 220 192T330 151T455 190"/>
      <path d="M330 151Q390 235 455 190T555 255"/>
    </g>
    <g className="pop-map-node pop-map-energy" transform="translate(95 205)">
      <circle r="25" fill="#122e36" stroke="#5ac9bb" strokeOpacity=".7"/><circle r="16" fill="none" stroke="#5ac9bb" strokeOpacity=".35"/><path d="m2-13-9 15h8l-2 12 11-17H2Z" fill="#8cebd8"/><text y="43">{gameText("SOLARA GRID")}</text>
    </g>
    <g className="pop-map-node pop-map-equipment" transform="translate(220 192)">
      <circle r="20" fill="#202b3d" stroke="#7da7e9" strokeOpacity=".8"/><path d="M-10-7h20v14h-20zM-5-12v5m10-5v5M-5 7v5m10-5v5" fill="none" stroke="#a9c8ff" strokeWidth="1.6"/><text y="39">{gameText("EQUIPMENT")}</text>
    </g>
    <g className="pop-map-node pop-map-player" transform="translate(330 151)" filter="url(#nodeGlow)">
      <circle r="31" fill="#153c3a" stroke="#77e5cb" strokeWidth="1.5"/><circle r="23" fill="none" stroke="#77e5cb" strokeOpacity=".5" strokeDasharray="3 4"/><path d="M-12 10V-9L0-16 12-9V10H4V-2H-4V10Z" fill="#b7ffe9"/><text y="52">{gameText("NODEWORKS")}</text>
    </g>
    <g className="pop-map-node pop-map-client" transform="translate(455 190)">
      <circle r="23" fill="#2a2638" stroke="#b39af0" strokeOpacity=".8"/><path d="M-11 8V-8h7v16m2 0V-13h7V8" fill="none" stroke="#d0bdff" strokeWidth="2"/><text y="42">{gameText("ASTERION AI")}</text>
    </g>
    <g className="pop-map-node pop-map-rival" transform="translate(530 115)">
      <circle r="20" fill="#382a25" stroke="#d69b6c" strokeOpacity=".8"/><path d="M-9 9V-8h18V9M-5-8v-5h10v5" fill="none" stroke="#f3bd8c" strokeWidth="1.8"/><text y="38">{gameText("KESTREL")}</text>
    </g>
    <g className="pop-map-node pop-map-market" transform="translate(555 255)">
      <circle r="15" fill="#1d2b3b" stroke="#8ca8c8" strokeOpacity=".7"/><path d="M-7 5V-1m7 6v-11m7 11V-5" stroke="#b5c9e7" strokeWidth="2"/><text y="31">{gameText("DEMAND")}</text>
    </g>
    <g className="pop-map-readout" transform="translate(18 18)">
      <rect width="152" height="49" rx="7" fill="#0a1720" fillOpacity=".88" stroke="#527e7e" strokeOpacity=".35"/>
      <text x="12" y="17">{gameText("GRID UTILIZATION")}</text><text className="pop-map-number" x="12" y="37">{Math.round(utilization)}%</text>
      <rect x="92" y="28" width="45" height="4" rx="2" fill="#29434b"/><rect x="92" y="28" width={45*utilization/100} height="4" rx="2" fill="#74e3d1"/>
    </g>
    <g className="pop-map-readout" transform="translate(450 18)">
      <rect width="150" height="49" rx="7" fill="#0a1720" fillOpacity=".88" stroke="#527e7e" strokeOpacity=".35"/>
      <text x="12" y="17">{gameText("NODEWORKS LIMIT")}</text><text className="pop-map-number" x="12" y="37">{capacity.toFixed(0)} MW</text>
      <text x="88" y="36" className="pop-map-subnumber">{Math.round(reliability*100)}% REL.</text>
    </g>
  </svg>;
}
