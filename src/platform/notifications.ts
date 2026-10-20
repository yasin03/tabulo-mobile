// Yerel bildirimler (6.5, 6.6, 8.4, 8.6). Uygulamanın geri kalanı expo-notifications'ı doğrudan kullanmaz.

import * as Notifications from 'expo-notifications';
import { Linking, Platform } from 'react-native';

const CHANNEL_ID = 'reminders';

export type NotificationPermission = 'granted' | 'denied' | 'undetermined';

export interface LocalNotification {
  /** Kayıttan türetilen sabit kimlik (`recurring-<id>`); yeniden kurmak aynı bildirimi değiştirir. */
  identifier: string;
  date: Date;
  title: string;
  body: string;
  /** Dokununca açılacak uygulama içi yol (ör. `/contact/<id>`). */
  url: string;
}

/**
 * Uygulama açıkken de bildirimi göster; Android'de kanal oluştur (Android 13+ izin penceresi kanal
 * olmadan çıkmaz). Kanal adı dil değişince güncellenir.
 */
export function configureNotifications(channelName: string): void {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    }),
  });
  if (Platform.OS === 'android') {
    void Notifications.setNotificationChannelAsync(CHANNEL_ID, {
      name: channelName,
      importance: Notifications.AndroidImportance.HIGH,
    });
  }
}

function toPermission(status: Notifications.NotificationPermissionsStatus): NotificationPermission {
  const ios = status.ios?.status;
  if (
    status.granted ||
    ios === Notifications.IosAuthorizationStatus.PROVISIONAL ||
    ios === Notifications.IosAuthorizationStatus.EPHEMERAL
  ) {
    return 'granted';
  }
  return status.canAskAgain ? 'undetermined' : 'denied';
}

/** İzin durumu; kullanıcıya bir şey sormaz. */
export async function getNotificationPermission(): Promise<NotificationPermission> {
  return toPermission(await Notifications.getPermissionsAsync());
}

/** Sistem izin penceresini açar (yalnızca henüz sorulmadıysa çıkar). */
export async function requestNotificationPermission(): Promise<NotificationPermission> {
  return toPermission(await Notifications.requestPermissionsAsync());
}

/** İzin reddedildiyse telefonun Ayarlar'ındaki uygulama sayfası (8.6). */
export function openSystemSettings(): void {
  void Linking.openSettings();
}

/** Bu uygulamanın kurduğu bildirimler (kimlik önekine göre). */
function isOurs(identifier: string): boolean {
  return identifier.startsWith('recurring-') || identifier.startsWith('reminder-');
}

/**
 * Kurulu bildirimleri istenen listeyle eşitler: listede olmayanlar iptal edilir, listedekiler
 * (aynı kimlikle) yeniden kurulur. İzin yoksa yalnızca iptal eder.
 */
export async function syncLocalNotifications(
  desired: readonly LocalNotification[],
  options: { canSchedule: boolean },
): Promise<void> {
  const wanted = new Set(options.canSchedule ? desired.map((n) => n.identifier) : []);
  const scheduled = await Notifications.getAllScheduledNotificationsAsync();
  await Promise.all(
    scheduled
      .filter((n) => isOurs(n.identifier) && !wanted.has(n.identifier))
      .map((n) => Notifications.cancelScheduledNotificationAsync(n.identifier)),
  );
  if (!options.canSchedule) return;

  for (const n of desired) {
    await Notifications.scheduleNotificationAsync({
      identifier: n.identifier,
      content: { title: n.title, body: n.body, data: { url: n.url }, sound: true },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date: n.date,
        channelId: CHANNEL_ID,
      },
    });
  }
}

/** Bildirime dokunulunca açılacak yol; uygulama kapalıyken açıldıysa ilk çağrıda da döner. */
export function subscribeToNotificationTaps(onUrl: (url: string) => void): () => void {
  const handle = (response: Notifications.NotificationResponse | null) => {
    if (!response || response.actionIdentifier !== Notifications.DEFAULT_ACTION_IDENTIFIER) return;
    const url = response.notification.request.content.data?.url;
    if (typeof url === 'string') onUrl(url);
    // Aynı dokunuş bir sonraki açılışta tekrar işlenmesin.
    void Notifications.clearLastNotificationResponseAsync();
  };
  handle(Notifications.getLastNotificationResponse());
  const subscription = Notifications.addNotificationResponseReceivedListener(handle);
  return () => subscription.remove();
}
