import React from 'react'

const PriceDisplay = ({ price, yearly }: { price: number | null; yearly: boolean }) => {
  if (price === null) {
    return (
      <div className="flex items-baseline gap-2">
        <span className="text-5xl font-semibold tracking-tight text-foreground">Custom</span>
      </div>
    );
  }

  if (price === 0) {
    return (
      <div className="flex items-baseline gap-2">
        <span className="text-5xl font-semibold tracking-tight text-foreground">$0</span>
        <span className="text-sm text-muted-foreground">forever</span>
      </div>
    );
  }

    return (
    <div className="flex items-baseline gap-2">
      <span className="text-5xl font-semibold tracking-tight text-foreground">${price}</span>
      <span className="text-sm text-muted-foreground">
        /mo{yearly ? ", billed annually" : ""}
      </span>
    </div>
    );
}

export default PriceDisplay;
