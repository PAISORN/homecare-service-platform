import { loadMobileHomeScaffold } from '../../data/mobile-home-scaffold';
import { HomeScreen } from '../../features/home/home-screen';
import { mobileHomeCopyTh } from '../../locales/th';

export default function HomeRoute() {
  return (
    <HomeScreen copy={mobileHomeCopyTh} model={loadMobileHomeScaffold()} />
  );
}
