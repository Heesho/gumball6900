import { Card, SkeletonBlock } from '@gumball-6900/ui';

export default function Loading() {
  return (
    <div aria-busy="true" aria-label="Loading protocol data">
      <SkeletonBlock className="h-4 w-28" />
      <SkeletonBlock className="mt-4 h-12 max-w-2xl" />
      <SkeletonBlock className="mt-4 h-5 max-w-xl" />
      <div className="mt-9 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }, (_, index) => (
          <Card className="p-5" key={index}>
            <SkeletonBlock className="h-3 w-24" />
            <SkeletonBlock className="mt-5 h-8 w-36" />
            <SkeletonBlock className="mt-3 h-3 w-28" />
          </Card>
        ))}
      </div>
      <div className="mt-5 grid gap-5 xl:grid-cols-2">
        <SkeletonBlock className="h-96" />
        <SkeletonBlock className="h-96" />
      </div>
    </div>
  );
}
