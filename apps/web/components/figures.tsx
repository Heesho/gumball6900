export function MechanismRail() {
  return (
    <div
      aria-label="Mine creates GBX, holders signal Strategies, Strategies acquire assets, and Fund backs redemption"
      className="mechanism-rail"
      role="img"
    >
      <div className="mechanism-rail__node mechanism-rail__node--pink">
        <span>01</span>
        <strong>Mine</strong>
        <small>issues GBX</small>
      </div>
      <RailArrow label="GBX" />
      <div className="mechanism-rail__node mechanism-rail__node--blue">
        <span>02</span>
        <strong>Signal</strong>
        <small>weights Strategies</small>
      </div>
      <RailArrow label="weight" />
      <div className="mechanism-rail__node mechanism-rail__node--dark">
        <span>03</span>
        <strong>Auction</strong>
        <small>acquires assets</small>
      </div>
      <RailArrow label="assets" />
      <div className="mechanism-rail__node mechanism-rail__node--white">
        <span>04</span>
        <strong>Fund</strong>
        <small>backs GBX</small>
      </div>
    </div>
  );
}

function RailArrow({ label }: { label: string }) {
  return (
    <div aria-hidden="true" className="mechanism-rail__arrow">
      <span>{label}</span>
      <i />
    </div>
  );
}

export function EmissionChart() {
  return (
    <svg
      aria-label="Illustrative time-based emission schedule declining toward the one GBX per second tail rate"
      className="line-chart"
      role="img"
      viewBox="0 0 720 300"
    >
      <g className="line-chart__grid">
        <path d="M22 35H700M22 94H700M22 153H700M22 212H700M22 271H700" />
      </g>
      <path className="line-chart__area" d="M24 45H150V105H278V165H406V214H534V248H698V271H24Z" />
      <path className="line-chart__primary" d="M24 45H150V105H278V165H406V214H534V248H698V271" />
      <g className="line-chart__points">
        <circle cx="24" cy="45" r="6" />
        <circle cx="150" cy="105" r="6" />
        <circle cx="278" cy="165" r="6" />
        <circle cx="406" cy="214" r="6" />
        <circle cx="534" cy="248" r="6" />
        <circle cx="698" cy="271" r="6" />
      </g>
    </svg>
  );
}

export function AuctionCurve() {
  return (
    <svg
      aria-label="Reverse Dutch auction price declining toward a floor over one hour"
      className="auction-curve"
      role="img"
      viewBox="0 0 720 300"
    >
      <g className="line-chart__grid">
        <path d="M22 35H700M22 94H700M22 153H700M22 212H700M22 271H700" />
      </g>
      <path className="auction-curve__line" d="M25 43C180 48 271 73 366 118C467 166 558 226 697 264" />
      <circle cx="25" cy="43" r="7" />
      <circle cx="697" cy="264" r="7" />
      <text x="25" y="27">
        start
      </text>
      <text textAnchor="end" x="697" y="292">
        floor
      </text>
    </svg>
  );
}

export function SignalBars() {
  const bars = [32, 42, 58, 76, 48, 88, 66, 98, 72, 54, 82, 64];
  return (
    <div aria-label="Illustrative holder signal distributed across Strategies" className="signal-bars" role="img">
      {bars.map((height, index) => (
        <i key={`${height}-${index}`} style={{ height: `${height}%` }} />
      ))}
    </div>
  );
}

export function RevenueSplit() {
  return (
    <div
      aria-label="Strategy purchase split: eighty to one hundred percent to Fund and zero to twenty percent to Bribe"
      className="revenue-split"
      role="img"
    >
      <div className="revenue-split__fund">
        <span>80–100%</span>
        <strong>Fund</strong>
      </div>
      <div className="revenue-split__bribe">
        <span>0–20%</span>
        <strong>Bribe</strong>
      </div>
    </div>
  );
}

export function GovernSurface() {
  return (
    <div aria-label="Four bounded continuing governance actions" className="govern-surface" role="img">
      <span>Add Strategy</span>
      <span>Kill Strategy</span>
      <span>Add reward token</span>
      <span>Set Bribe rate</span>
    </div>
  );
}
