import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:lumem/providers/settings_provider.dart';
import 'package:lumem/models/dream.dart';
import 'package:lumem/services/dream_service.dart';
import 'package:lumem/views/widgets/dream_card.dart';

class Home extends StatefulWidget {
  const Home({super.key});

  @override
  _HomeState createState() => _HomeState();
}

class _HomeState extends State<Home> {
  final DreamService _dreamService = DreamService();

  List<Dream> _forYouDreams = [];
  List<Dream> _followingDreams = [];
  bool _isLoadingForYou = true;
  bool _isLoadingFollowing = true;
  bool _hasErrorForYou = false;
  bool _hasErrorFollowing = false;

  @override
  void initState() {
    super.initState();
    _loadForYou();
    _loadFollowing();
  }

  Future<void> _loadForYou() async {
    setState(() {
      _isLoadingForYou = true;
      _hasErrorForYou = false;
    });
    try {
      final dreams = await _dreamService.getFeed();
      setState(() {
        _forYouDreams = dreams;
        _isLoadingForYou = false;
      });
    } catch (e) {
      setState(() {
        _isLoadingForYou = false;
        _hasErrorForYou = true;
      });
    }
  }

  Future<void> _loadFollowing() async {
    setState(() {
      _isLoadingFollowing = true;
      _hasErrorFollowing = false;
    });
    try {
      final dreams = await _dreamService.getFeed(following: true);
      setState(() {
        _followingDreams = dreams;
        _isLoadingFollowing = false;
      });
    } catch (e) {
      setState(() {
        _isLoadingFollowing = false;
        _hasErrorFollowing = true;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    return Consumer<SettingsProvider>(
      builder: (context, settings, child) {
        final showAlgorithmic = settings.showAlgorithmicFeed;
        return DefaultTabController(
          length: showAlgorithmic ? 2 : 1,
          child: Scaffold(
            appBar: AppBar(
              title: const Text(
                'Dream Share',
                style: TextStyle(fontWeight: FontWeight.bold),
              ),
              centerTitle: true,
              actions: [
                IconButton(
                  icon: const Icon(Icons.refresh),
                  onPressed: () {
                    if (showAlgorithmic) _loadForYou();
                    _loadFollowing();
                  },
                ),
              ],
              bottom: TabBar(
                indicatorColor: Theme.of(context).colorScheme.secondary,
                labelColor: Theme.of(context).colorScheme.secondary,
                unselectedLabelColor: Colors.grey,
                tabs: showAlgorithmic
                    ? const [Tab(text: 'Para Você'), Tab(text: 'Seguindo')]
                    : const [Tab(text: 'Seguindo')],
              ),
            ),
            body: TabBarView(
              children: showAlgorithmic
                  ? [
                      _buildFeedList(
                        dreams: _forYouDreams,
                        isLoading: _isLoadingForYou,
                        hasError: _hasErrorForYou,
                        onRefresh: _loadForYou,
                        emptyMessage: 'Nenhum sonho ainda...',
                        emptySubMessage: 'Seja o primeiro a compartilhar!',
                      ),
                      _buildFeedList(
                        dreams: _followingDreams,
                        isLoading: _isLoadingFollowing,
                        hasError: _hasErrorFollowing,
                        onRefresh: _loadFollowing,
                        emptyMessage: 'Nenhum sonho de quem você segue',
                        emptySubMessage: 'Siga outros usuários para ver sonhos aqui!',
                      ),
                    ]
                  : [
                      _buildFeedList(
                        dreams: _followingDreams,
                        isLoading: _isLoadingFollowing,
                        hasError: _hasErrorFollowing,
                        onRefresh: _loadFollowing,
                        emptyMessage: 'Nenhum sonho de quem você segue',
                        emptySubMessage: 'Siga outros usuários para ver sonhos aqui!',
                      ),
                    ],
            ),
          ),
        );
      },
    );
  }

  Widget _buildFeedList({
    required List<Dream> dreams,
    required bool isLoading,
    required bool hasError,
    required Future<void> Function() onRefresh,
    required String emptyMessage,
    required String emptySubMessage,
  }) {
    if (isLoading) {
      return const Center(child: CircularProgressIndicator());
    }

    if (hasError) {
      return Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            const Icon(Icons.cloud_off, size: 64, color: Colors.grey),
            const SizedBox(height: 16),
            const Text(
              'Erro ao carregar sonhos',
              style: TextStyle(fontSize: 18, color: Colors.grey),
            ),
            const SizedBox(height: 8),
            ElevatedButton(
              onPressed: onRefresh,
              child: const Text('Tentar novamente'),
            ),
          ],
        ),
      );
    }

    if (dreams.isEmpty) {
      return Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            const Icon(Icons.nightlight_round, size: 64, color: Colors.grey),
            const SizedBox(height: 16),
            Text(
              emptyMessage,
              style: const TextStyle(fontSize: 18, color: Colors.grey),
            ),
            const SizedBox(height: 8),
            Text(
              emptySubMessage,
              style: const TextStyle(color: Colors.grey),
            ),
          ],
        ),
      );
    }

    return RefreshIndicator(
      onRefresh: onRefresh,
      child: ListView.builder(
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
        itemCount: dreams.length,
        itemBuilder: (context, index) {
          return DreamCard(dream: dreams[index], onUpdate: onRefresh);
        },
      ),
    );
  }
}
