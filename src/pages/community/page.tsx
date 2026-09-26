
import { CommunityFeed } from '@/components/community/feed';
import Header from '@/components/Header';

export default function CommunityPage() {
  return (
    <>
      <Header />
      <main className="pt-16">
        <CommunityFeed />
      </main>
    </>
  );
}
