import { HomeLanding } from "@/components/HomeLanding";

export default function HomePage() {
  return <HomeLanding featuredSharePath={process.env.NEXT_PUBLIC_FEATURED_SHARE_PATH} />;
}
