import { useCountUp } from '@/hooks/useCountUp';

/** Número que cuenta desde 0 al montarse — para KPIs. `decimals` controla el formato final. */
export function AnimatedNumber({ value, decimals = 0, suffix = '' }: { value: number; decimals?: number; suffix?: string }) {
  const current = useCountUp(value);
  return (
    <span>
      {current.toFixed(decimals)}
      {suffix}
    </span>
  );
}
