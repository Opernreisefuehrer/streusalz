export function PackageArt({ kind }: { kind: "bigbag" | "bags" }) {
  return <svg viewBox="0 0 400 270" role="img" aria-label={kind === "bigbag" ? "Technische Illustration: BigBag mit 1.000 kg Füllgewicht, nicht maßstabsgetreu" : "Technische Illustration: Palette mit 40 Säcken à 25 kg, insgesamt 1.000 kg. Schematische Vorderansicht mit versetzten Sacklagen; hintere Säcke sind verdeckt."} className="package-art" fill="#285379" fontFamily="Arial, sans-serif" textAnchor="middle">
    <defs>
      <pattern id={`drawing-grid-${kind}`} width="16" height="16" patternUnits="userSpaceOnUse">
        <path d="M16 0H0V16" fill="none" stroke="#cad9e6" strokeWidth=".5" />
      </pattern>
    </defs>
    <rect x="24" y="69" width="352" height="174" fill={`url(#drawing-grid-${kind})`} />
    <path d="M150 71V243M38 222H265" fill="none" stroke="#91a9bd" strokeWidth=".8" strokeDasharray="5 4" />
    {kind === "bigbag" ? <>
      <g stroke="#285379" strokeWidth="1.8" strokeLinejoin="round">
        <path d="M91 96V83q0-19 15-19t15 19v13M183 96V83q0-19 15-19t15 19v13" fill="none" />
        <path d="M80 96q72-16 144 0l10 115q-82 19-164 0z" fill="#f8fafc" />
        <path d="M80 96q72 18 144 0M72 203q80 17 160 0" fill="none" />
        <path d="M99 99l-8 106M205 99l8 106" fill="none" strokeWidth="1" strokeDasharray="3 3" />
        <path d="M80 110l-8 87M224 110l8 87" fill="none" strokeWidth=".7" />
        <rect x="126" y="144" width="52" height="35" fill="none" strokeWidth="1" />
        <path d="M136 154h32M136 161h32M136 168h20" fill="none" strokeWidth=".7" />
      </g>
      <path d="M229 151h26l18-23h17" fill="none" stroke="#285379" strokeWidth="1" />
      <circle cx="229" cy="151" r="2.5" />
      <text x="275" y="100" textAnchor="start" fontSize="13">Füllgewicht</text>
      <text x="275" y="119" textAnchor="start" fontSize="18" fontWeight="700">1.000 kg</text>
      <text x="200" y="263" fontSize="16">1 BigBag = 1 Tonne</text>
    </> : <>
      {Array.from({ length: 8 }, (_, layer) => {
        const visibleSacks = layer % 2 === 0 ? 2 : 3;
        const width = 180 / visibleSacks;
        return <g key={layer} data-layer={layer + 1} transform={`translate(60 ${205 - layer * 16})`}>
          {Array.from({ length: visibleSacks }, (_, sack) => <g key={sack} data-visible-sack="true" transform={`translate(${sack * width} 0)`}>
            <path d={`M5 1H${width - 5}Q${width + 1} 8 ${width - 5} 15H5Q-1 8 5 1Z`} fill="#f8fafc" stroke="#285379" strokeWidth="1.3" />
            <path d={`M8 5V11M${width - 8} 5V11`} fill="none" stroke="#285379" strokeWidth=".7" />
            <path d={`M15 8H${width - 15}`} fill="none" stroke="#91a9bd" strokeWidth=".7" strokeDasharray="2 3" />
          </g>)}
        </g>;
      })}
      <g fill="#f8fafc" stroke="#285379" strokeWidth="1.3">
        <rect x="52" y="222" width="196" height="7" />
        <rect x="61" y="229" width="24" height="10" />
        <rect x="138" y="229" width="24" height="10" />
        <rect x="215" y="229" width="24" height="10" />
        <path d="M52 241h196" fill="none" />
      </g>
      <path d="M237 149h21l15-21h17" fill="none" stroke="#285379" strokeWidth="1" />
      <circle cx="237" cy="149" r="2.5" />
      <text x="275" y="100" textAnchor="start" fontSize="18" fontWeight="700">40 Säcke</text>
      <text x="275" y="119" textAnchor="start" fontSize="15">à 25 kg</text>
      <text x="200" y="263" fontSize="16">40 × 25 kg = 1.000 kg je Palette</text>
    </>}
  </svg>;
}
