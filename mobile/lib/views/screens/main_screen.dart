import 'package:flutter/material.dart';
import 'package:dreamshare/views/screens/home.dart';
import 'package:dreamshare/views/screens/communities.dart';
import 'package:dreamshare/views/screens/explore.dart';
import 'package:dreamshare/views/screens/notifications_dms.dart';
import 'package:dreamshare/views/screens/profile.dart';
import 'package:dreamshare/views/screens/create_dream.dart';
import 'package:dreamshare/services/notification_service.dart';

class MainScreen extends StatefulWidget {
  const MainScreen({super.key});

  @override
  _MainScreenState createState() => _MainScreenState();
}

class _MainScreenState extends State<MainScreen> {
  late PageController _pageController;
  int _page = 0;
  int _unreadCount = 0;
  final NotificationService _notificationService = NotificationService();

  final List<Widget> _pages = [
    const Home(),
    const Communities(),
    const Explore(),
    const NotificationsDms(),
    const Profile(),
  ];

  @override
  void initState() {
    super.initState();
    _pageController = PageController(initialPage: 0);
    _loadUnreadCount();
  }

  Future<void> _loadUnreadCount() async {
    try {
      final notifs = await _notificationService.getNotifications();
      if (mounted) {
        setState(() {
          _unreadCount = notifs.where((n) => !n.lida).length;
        });
      }
    } catch (_) {}
  }

  @override
  void dispose() {
    _pageController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: PageView(
        physics: const NeverScrollableScrollPhysics(),
        controller: _pageController,
        onPageChanged: onPageChanged,
        children: _pages,
      ),
      floatingActionButton: FloatingActionButton(
        backgroundColor: Theme.of(context).colorScheme.secondary,
        child: const Icon(Icons.add, color: Colors.white),
        onPressed: () {
          Navigator.push(
            context,
            MaterialPageRoute(builder: (_) => const CreateDream()),
          );
        },
      ),
      bottomNavigationBar: BottomNavigationBar(
        type: BottomNavigationBarType.fixed,
        backgroundColor: Theme.of(context).scaffoldBackgroundColor,
        selectedItemColor: Theme.of(context).colorScheme.secondary,
        unselectedItemColor: Colors.grey,
        currentIndex: _page,
        onTap: navigationTapped,
        items: [
          const BottomNavigationBarItem(
            icon: Icon(Icons.home_rounded),
            label: 'Home',
          ),
          const BottomNavigationBarItem(
            icon: Icon(Icons.holiday_village_rounded),
            label: 'Comunidades',
          ),
          const BottomNavigationBarItem(
            icon: Icon(Icons.explore_rounded),
            label: 'Explorar',
          ),
          BottomNavigationBarItem(
            icon: Badge(
              isLabelVisible: _unreadCount > 0,
              label: Text(_unreadCount.toString()),
              child: const Icon(Icons.notifications_rounded),
            ),
            label: 'Alertas',
          ),
          const BottomNavigationBarItem(
            icon: Icon(Icons.person_rounded),
            label: 'Perfil',
          ),
        ],
      ),
    );
  }

  void navigationTapped(int page) {
    _pageController.jumpToPage(page);
    if (page == 3) {
      _notificationService.markAllAsRead();
      setState(() {
        _unreadCount = 0;
      });
    } else {
      _loadUnreadCount();
    }
  }

  void onPageChanged(int page) {
    setState(() {
      _page = page;
    });
    if (page == 3) {
      _notificationService.markAllAsRead();
      setState(() {
        _unreadCount = 0;
      });
    } else {
      _loadUnreadCount();
    }
  }
}
