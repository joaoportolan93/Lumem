import 'package:flutter/material.dart';
import 'package:cached_network_image/cached_network_image.dart';
import 'package:dreamshare/models/notification_model.dart';
import 'package:dreamshare/services/notification_service.dart';
import 'package:dreamshare/util/data.dart';
import 'package:dreamshare/views/widgets/chat_item.dart';
import 'package:timeago/timeago.dart' as timeago;

class NotificationsDms extends StatefulWidget {
  @override
  _NotificationsDmsState createState() => _NotificationsDmsState();
}

class _NotificationsDmsState extends State<NotificationsDms>
    with SingleTickerProviderStateMixin {
  late TabController _tabController;
  final NotificationService _notificationService = NotificationService();
  List<AppNotification> _notifications = [];
  bool _isLoading = true;

  @override
  void initState() {
    super.initState();
    _tabController = TabController(length: 2, vsync: this);
    _loadNotifications();
  }

  @override
  void dispose() {
    _tabController.dispose();
    super.dispose();
  }

  Future<void> _loadNotifications() async {
    setState(() => _isLoading = true);
    final notifs = await _notificationService.getNotifications();
    setState(() {
      _notifications = notifs;
      _isLoading = false;
    });
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text(
          'Alertas',
          style: TextStyle(fontWeight: FontWeight.bold),
        ),
        centerTitle: true,
        bottom: TabBar(
          controller: _tabController,
          indicatorColor: Theme.of(context).colorScheme.secondary,
          labelColor: Theme.of(context).colorScheme.secondary,
          unselectedLabelColor: Colors.grey,
          tabs: const [
            Tab(icon: Icon(Icons.notifications_rounded), text: 'Notificações'),
            Tab(icon: Icon(Icons.chat_rounded), text: 'Mensagens'),
          ],
        ),
      ),
      body: TabBarView(
        controller: _tabController,
        children: [
          // Tab 1: Notifications
          _buildNotificationsTab(),
          // Tab 2: DMs (reusing chat list from template)
          _buildDmsTab(),
        ],
      ),
    );
  }

  Widget _buildNotificationsTab() {
    if (_isLoading) {
      return const Center(child: CircularProgressIndicator());
    }

    if (_notifications.isEmpty) {
      return const Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(Icons.notifications_off, size: 64, color: Colors.grey),
            SizedBox(height: 16),
            Text(
              'Nenhuma notificação',
              style: TextStyle(fontSize: 18, color: Colors.grey),
            ),
          ],
        ),
      );
    }

    return RefreshIndicator(
      onRefresh: _loadNotifications,
      child: ListView.separated(
        padding: const EdgeInsets.all(10),
        separatorBuilder: (_, __) => const Divider(height: 1),
        itemCount: _notifications.length,
        itemBuilder: (context, index) {
          final notif = _notifications[index];
          return ListTile(
            leading: CircleAvatar(
              radius: 25,
              backgroundImage: notif.remetenteAvatar != null
                  ? CachedNetworkImageProvider(notif.remetenteAvatar!)
                  : null,
              child: notif.remetenteAvatar == null
                  ? const Icon(Icons.person)
                  : null,
            ),
            title: Text(
              notif.conteudo ?? _getNotifText(notif),
              style: TextStyle(
                fontWeight: notif.lida ? FontWeight.normal : FontWeight.bold,
              ),
            ),
            subtitle: Text(
              timeago.format(notif.dataCriacao, locale: 'pt_BR'),
              style: TextStyle(
                color: Colors.grey[500],
                fontSize: 12,
              ),
            ),
            tileColor: notif.lida ? null : Theme.of(context).colorScheme.secondary.withOpacity(0.05),
            onTap: () async {
              await _notificationService.markAsRead(notif.id);
              _loadNotifications();
            },
          );
        },
      ),
    );
  }

  Widget _buildDmsTab() {
    // Reuse chat data from the template for now
    return ListView.separated(
      padding: const EdgeInsets.all(10),
      separatorBuilder: (_, __) => const Divider(height: 1),
      itemCount: chats.length,
      itemBuilder: (context, index) {
        Map chat = chats[index];
        return ChatItem(
          dp: chat['dp'],
          name: chat['name'],
          msg: chat['msg'],
          isOnline: chat['isOnline'],
          counter: chat['counter'],
          time: chat['time'],
        );
      },
    );
  }

  String _getNotifText(AppNotification notif) {
    final nome = notif.remetenteNome ?? 'Alguém';
    switch (notif.tipo) {
      case 'curtida':
      case '1':
        return '$nome curtiu seu sonho';
      case 'comentario':
      case '2':
        return '$nome comentou no seu sonho';
      case 'seguir':
      case '3':
        return '$nome começou a te seguir';
      default:
        return '$nome interagiu com você';
    }
  }
}
