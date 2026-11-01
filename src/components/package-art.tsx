export function PackageArt({ kind }: { kind: "bigbag" | "bags" }) {
  return <svg viewBox="0 0 400 270" role="img" aria-label={kind === "bigbag" ? "Illustration eines BigBags auf Palette" : "Illustration einer vollen Palette: 40 Säcke à 25 kg in acht Lagen, insgesamt 1.000 kg"} className="package-art">
    <defs><linearGradient id={`fabric-${kind}`} x1="0" y1="0" x2="1" y2="1"><stop stopColor="#fff" /><stop offset="1" stopColor="#c8d2df" /></linearGradient><filter id={`shadow-${kind}`}><feGaussianBlur stdDeviation="8" /></filter></defs>
    <ellipse cx="210" cy="244" rx="120" ry="13" fill="#8fa1b8" opacity=".25" filter={`url(#shadow-${kind})`} />
    <path d="M85 218l206-5 39 17-211 10z" fill="#a28769" /><path d="M119 240l211-10v12l-211 10z" fill="#6b5743" /><path d="M85 218v13l34 21v-12z" fill="#8d7255" />
    {kind === "bigbag" ? <><path d="M127 86q-20-62 10-65q19 3 16 63M253 78q-8-60 19-61q23 3 12 72" fill="none" stroke="#e6e9ed" strokeWidth="12" /><path d="M111 90q84-30 177-9l13 126q-71 27-192 13z" fill={`url(#fabric-${kind})`} stroke="#bac7d4" strokeWidth="2" /><path d="M110 91q40 14 58 11l-2 121M284 84l-18 136" fill="none" stroke="#a8b6c6" strokeWidth="2" opacity=".5" /><path d="M112 91q79-35 176-10q-30 29-91 26z" fill="#f4f6f9" /><rect x="181" y="139" width="78" height="52" rx="2" fill="#172d49" /><text x="220" y="161" textAnchor="middle" fontSize="10" fill="white" fontFamily="Arial">STREUSALZ</text><text x="220" y="178" textAnchor="middle" fontSize="13" fill="#f5ba63" fontFamily="Arial">1.000 kg</text></> : <>
      {Array.from({ length: 8 }, (_, layer) => {
        const arrangement = layer % 2 === 0
          ? [{ x: 126, y: 186, width: 58 }, { x: 186, y: 184, width: 58 }, { x: 246, y: 182, width: 58 }, { x: 101, y: 201, width: 94 }, { x: 199, y: 198, width: 94 }]
          : [{ x: 126, y: 186, width: 88 }, { x: 218, y: 183, width: 88 }, { x: 101, y: 201, width: 60 }, { x: 166, y: 200, width: 60 }, { x: 231, y: 198, width: 60 }];
        return <g key={layer} data-layer={layer + 1} transform={`translate(0,${-layer * 20})`}>
        {arrangement.map(({ x, y, width }, sack) => <g key={sack} data-sack="true" transform={`translate(${x} ${y})`}>
          <path d={`M4 0Q${width / 2} -5 ${width - 4} 0Q${width + 5} 8 ${width - 3} 18Q${width / 2} 22 3 18Q-7 10 4 0Z`} fill={`url(#fabric-${kind})`} stroke="#afbfce" strokeWidth="1" />
          <path d={`M7 10H${width - 7}`} stroke="#b6c5d3" opacity=".6" />
          {y >= 198 && <><rect x={width / 2 - 20} y="5" width="40" height="11" rx="2" fill="#172d49" /><text x={width / 2} y="13" textAnchor="middle" fontSize="6" fill="#fff" fontFamily="Arial">25 kg</text></>}
        </g>;
        })}
      </g>)}
      <rect x="153" y="228" width="118" height="17" rx="3" fill="#172d49" /><text x="212" y="240" textAnchor="middle" fontSize="9" fill="#fff" fontFamily="Arial">40 × 25 kg = 1.000 kg</text>
    </>}
  </svg>;
}
