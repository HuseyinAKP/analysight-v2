"use client";
import dynamic from "next/dynamic";

interface Props { data: { i: number; v: number }[]; color: string }

const Chart = dynamic(
  () =>
    import("recharts").then(({ LineChart, Line, ResponsiveContainer }) => {
      function SparkLineInner({ data, color }: Props) {
        return (
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data}>
              <Line type="monotone" dataKey="v" stroke={color} strokeWidth={1.5} dot={false} isAnimationActive={false} />
            </LineChart>
          </ResponsiveContainer>
        );
      }
      return { default: SparkLineInner };
    }),
  { ssr: false, loading: () => <div className="w-full h-full bg-gray-800 rounded animate-pulse" /> }
);

export function SparkLine({ data, color }: Props) {
  return <Chart data={data} color={color} />;
}
