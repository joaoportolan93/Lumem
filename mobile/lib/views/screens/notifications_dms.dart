import 'package:flutter/material.dart';
import 'package:cached_network_image/cached_network_image.dart';
import 'package:dreamshare/models/notification_model.dart';
import 'package:dreamshare/models/user.dart';
import 'package:dreamshare/services/notification_service.dart';
import 'package:dreamshare/services/user_service.dart';
import 'package:dreamshare/util/data.dart';
import 'package:dreamshare/views/widgets/chat_item.dart';
import 'package:timeago/timeago.dart' as timeago;
import 'package:dreamshare/views/screens/user_profile.dart';
import 'package:dreamshare/views/screens/dream_detail.dart';

class NotificationsDms extends StatefulWidget {
  const NotificationsDms({super.key});

  @override
  _NotificationsDmsState createState() => _NotificationsDmsState();
}

class _NotificationsDmsState extends State<NotificationsDms>
    with SingleTickerProviderStateMixin {
  late TabController _tabController;
  final NotificationService _notificationService = NotificationService();
  final UserService _userService = UserService();

  List<AppNotification> _notifications = [];
  List<User> _followRequests = [];

  bool _isLoading = true;
  bool _requestsLoading = true;

  @override
  void initState() {
    super.initState();
    _tabController = TabController(length: 2, vsync: this);
    _loadAllData();
  }

  @override
  void dispose() {
    _tabController.dispose();
    super.dispose();
  }

  Future<void> _loadAllData() async {
    _loadNotifications();
    _loadFollowRequests();
  }

  Future<void> _loadFollowRequests() async {
    if (!mounted) return;
    setState(() => _requestsLoading = true);
    final reqs = await _userService.getFollowRequests();
    if (!mounted) return;
    setState(() {
      _followRequests = reqs;
      _requestsLoading = false;
    });
  }

  Future<void> _loadNotifications() async {
    if (!mounted) return;
    setState(() => _isLoading = true);
    final notifs = await _notificationService.getNotifications();
    if (!mounted) return;
    setState(() {
      _notifications = notifs;
      _isLoading = false;
    });
  }

  Future<void> _handleAccept(String userId) async {
    final success = await _userService.acceptFollowRequest(userId);
    if (success && mounted) {
      setState(() {
        _followRequests.removeWhere((r) => r.id == userId);
      });
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Solicitação aceita com sucesso!', style: TextStyle(color: Colors.white)), backgroundColor: Colors.green),
      );
    }
  }

  Future<void> _handleReject(String userId) async {
    final success = await _userService.rejectFollowRequest(userId);
    if (success && mounted) {
      setState(() {
        _followRequests.removeWhere((r) => r.id == userId);
      });
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Solicitação recusada.')),
      );
    }
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
          // Tab 1: Notifications & Requests
          _buildNotificationsTab(),
          // Tab 2: DMs (reusing chat list from template)
          _buildDmsTab(),
        ],
      ),
    );
  }

  Widget _buildFollowRequestsSection() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const Padding(
          padding: EdgeInsets.fromLTRB(16, 16, 16, 8),
          child: Text(
            'Solicitações para seguir',
            style: TextStyle(fontWeight: FontWeight.bold, fontSize: 16),
          ),
        ),
        ..._followRequests.map((req) => ListTile(
              leading: CircleAvatar(
                radius: 25,
                backgroundImage: req.avatar != null
                    ? CachedNetworkImageProvider(req.avatar!)
                    : null,
                child: req.avatar == null ? const Icon(Icons.person) : null,
              ),
              title: Text(req.nomeCompleto,
                  style: const TextStyle(fontWeight: FontWeight.bold)),
              subtitle: Text('@${req.nomeUsuario}'),
              trailing: Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  IconButton(
                    icon: const Icon(Icons.close, color: Colors.grey),
                    onPressed: () => _handleReject(req.id),
                    tooltip: 'Recusar',
                  ),
                  IconButton(
                    icon: const Icon(Icons.check, color: Color(0xFF764BA2)), // Primary Color
                    onPressed: () => _handleAccept(req.id),
                    tooltip: 'Aceitar',
                  ),
                ],
              ),
            )),
        const Divider(thickness: 4),
      ],
    );
  }

  Widget _buildNotificationsTab() {
    return RefreshIndicator(
      onRefresh: _loadAllData,
      child: CustomScrollView(
        slivers: [
          if (_requestsLoading)
            const SliverToBoxAdapter(
              child: Center(
                  child: Padding(
                padding: EdgeInsets.all(16),
                child: CircularProgressIndicator(),
              )),
            ),
          if (!_requestsLoading && _followRequests.isNotEmpty)
            SliverToBoxAdapter(
              child: _buildFollowRequestsSection(),
            ),
          if (!_isLoading && _notifications.isEmpty)
            const SliverFillRemaining(
              hasScrollBody: false,
              child: Center(
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
              ),
            ),
          if (!_isLoading && _notifications.isNotEmpty)
            SliverList(
              delegate: SliverChildBuilderDelegate(
                (context, index) {
                  final notif = _notifications[index];
                  return Column(
                    children: [
                      ListTile(
                        contentPadding: const EdgeInsets.symmetric(
                            horizontal: 16, vertical: 8),
                        leading: CircleAvatar(
                          radius: 25,
                          backgroundImage: notif.remetenteAvatar != null
                              ? CachedNetworkImageProvider(
                                  notif.remetenteAvatar!)
                              : null,
                          child: notif.remetenteAvatar == null
                              ? const Icon(Icons.person)
                              : null,
                        ),
                        title: Text.rich(
                          TextSpan(
                            style: TextStyle(
                              color: Theme.of(context).textTheme.bodyLarge?.color,
                              fontWeight: notif.lida ? FontWeight.normal : FontWeight.bold,
                            ),
                            children: _buildNotifTextSpans(notif),
                          ),
                        ),
                        subtitle: Text(
                          timeago.format(notif.dataCriacao, locale: 'pt_BR'),
                          style: TextStyle(
                            color: Colors.grey[500],
                            fontSize: 12,
                          ),
                        ),
                        tileColor: notif.lida
                            ? null
                            : Theme.of(context)
                                .colorScheme
                                .secondary
                                .withValues(alpha: 0.05),
                        onTap: () async {
                          if (!notif.lida) {
                            await _notificationService.markAsRead(notif.id);
                            _loadNotifications();
                          }
                          // Redirect
                          if (notif.tipo == 'follower' || notif.tipo == 'follow_accept' || notif.tipo == '3') {
                            if (notif.remetenteId != null) {
                              Navigator.push(context, MaterialPageRoute(builder: (_) => UserProfile(userId: notif.remetenteId!)));
                            }
                          } else if (notif.publicacaoId != null) {
                              Navigator.push(context, MaterialPageRoute(builder: (_) => DreamDetail(dreamId: notif.publicacaoId!)));
                          }
                        },
                      ),
                      const Divider(height: 1),
                    ],
                  );
                },
                childCount: _notifications.length,
              ),
            ),
        ],
      ),
    );
  }

  Widget _buildDmsTab() {
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

  List<TextSpan> _buildNotifTextSpans(AppNotification notif) {
    final nome = notif.remetenteNome ?? 'Alguém';
    final conteudo = notif.conteudo != null && notif.conteudo!.isNotEmpty ? notif.conteudo! : '';

    String acao = '';

    switch (notif.tipo) {
      case 'like':
      case 'curtida':
      case '1':
        acao = ' curtiu seu sonho';
        break;
      case 'comment':
      case 'comentario':
      case '2':
        acao = ' comentou no seu sonho';
        break;
      case 'follower':
      case 'seguir':
      case '3':
        acao = ' começou a te seguir';
        break;
      case 'follow_accept':
        acao = ' aceitou sua solicitação de seguir';
        break;
      case 'reply':
        acao = ' respondeu seu comentário';
        break;
      default:
        if (conteudo.isNotEmpty && nome == 'Alguém') return [TextSpan(text: conteudo)];
        acao = ' interagiu com você';
    }

    return [
      TextSpan(text: nome, style: const TextStyle(fontWeight: FontWeight.bold)),
      TextSpan(text: acao),
      if (conteudo.isNotEmpty && notif.tipo != 'follower' && notif.tipo != 'follow_accept')
        TextSpan(text: ': $conteudo'),
    ];
  }
}
