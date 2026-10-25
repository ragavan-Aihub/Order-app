export const notificationsPermissionCopy = {
  title: 'Stay in the Loop!',
  subtitle: 'Get important updates, right when they happen.',
  bullets: [
    {
      title: 'Items you asked for',
      body: 'Get notified when a product you tapped “Notify me” on is back in stock.',
      icon: 'notifications-outline' as const,
      iconColor: '#DC2626',
      cardBg: '#FFF7ED',
      iconBg: '#FFEDD5',
    },
    {
      title: 'Order updates',
      body: 'Real-time alerts when your order is confirmed, on the way, or delivered.',
      icon: 'truck-delivery-outline' as const,
      iconSet: 'material-community' as const,
      iconColor: '#1D4ED8',
      cardBg: '#EFF6FF',
      iconBg: '#DBEAFE',
    },
  ],
  allow: 'Allow Notifications',
  notNow: 'Not Now',
};
