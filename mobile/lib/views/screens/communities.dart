import 'package:flutter/material.dart';
import 'package:cached_network_image/cached_network_image.dart';
import 'package:lumem/models/community.dart';
import 'package:lumem/services/community_service.dart';
import 'package:lumem/views/screens/community_detail.dart';
import 'package:lumem/views/screens/create_community.dart';

class Communities extends StatefulWidget {
  const Communities({super.key});

  @override
  _CommunitiesState createState() => _CommunitiesState();
}

class _CommunitiesState extends State<Communities> {
  final CommunityService _communityService = CommunityService();
  List<Community> _communities = [];
  bool _isLoading = true;

  @override
  void initState() {
    super.initState();
    _loadCommunities();
  }

  Future<void> _loadCommunities() async {
    setState(() => _isLoading = true);
    final communities = await _communityService.getCommunities();
    setState(() {
      _communities = communities;
      _isLoading = false;
    });
  }

  Future<void> _toggleJoin(Community community) async {
    bool success;
    if (community.isMembro) {
      success = await _communityService.leaveCommunity(community.id);
    } else {
      success = await _communityService.joinCommunity(community.id);
    }
    if (success) {
      _loadCommunities();
    } else if (mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Erro ao atualizar participação.'),
          backgroundColor: Colors.red,
        ),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text(
          'Comunidades',
          style: TextStyle(fontWeight: FontWeight.bold),
        ),
        centerTitle: true,
      ),
      body: _isLoading
          ? const Center(child: CircularProgressIndicator())
          : _communities.isEmpty
              ? const Center(
                  child: Column(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      Icon(Icons.holiday_village_rounded,
                          size: 64, color: Colors.grey),
                      SizedBox(height: 16),
                      Text(
                        'Nenhuma comunidade encontrada',
                        style: TextStyle(fontSize: 18, color: Colors.grey),
                      ),
                    ],
                  ),
                )
              : RefreshIndicator(
                  onRefresh: _loadCommunities,
                  child: ListView.builder(
                    padding: const EdgeInsets.all(16),
                    itemCount: _communities.length,
                    itemBuilder: (context, index) {
                      final community = _communities[index];
                      return _buildCommunityCard(community);
                    },
                  ),
                ),
      floatingActionButton: FloatingActionButton.extended(
        onPressed: () {
          Navigator.push(
            context,
            MaterialPageRoute(builder: (_) => const CreateCommunityScreen()),
          ).then((_) => _loadCommunities());
        },
        icon: const Icon(Icons.add),
        label: const Text('Nova Comunidade'),
        backgroundColor: Theme.of(context).colorScheme.primary,
        foregroundColor: Colors.white,
      ),
    );
  }

  Widget _buildCommunityCard(Community community) {
    final theme = Theme.of(context);
    final isDark = theme.brightness == Brightness.dark;

    return Card(
      margin: const EdgeInsets.only(bottom: 12),
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
      elevation: isDark ? 1 : 2,
      child: InkWell(
        borderRadius: BorderRadius.circular(16),
        onTap: () {
          Navigator.push(
            context,
            MaterialPageRoute(
              builder: (_) => CommunityDetail(communityId: community.id),
            ),
          ).then((_) => _loadCommunities());
        },
        child: Padding(
          padding: const EdgeInsets.all(12),
          child: Row(
            children: [
              // Imagem da comunidade (quadrada arredondada)
              ClipRRect(
                borderRadius: BorderRadius.circular(12),
                child: SizedBox(
                  width: 64,
                  height: 64,
                  child: community.imagem != null
                      ? CachedNetworkImage(
                          imageUrl: community.imagem!,
                          fit: BoxFit.cover,
                          placeholder: (_, __) => Container(
                            color: theme.colorScheme.secondary
                                .withValues(alpha: 0.2),
                            child: Icon(Icons.group,
                                color: theme.colorScheme.secondary),
                          ),
                          errorWidget: (_, __, ___) => Container(
                            color: theme.colorScheme.secondary
                                .withValues(alpha: 0.2),
                            child: Center(
                              child: Text(
                                community.nome.substring(0, 1).toUpperCase(),
                                style: TextStyle(
                                  fontWeight: FontWeight.bold,
                                  fontSize: 24,
                                  color: theme.colorScheme.secondary,
                                ),
                              ),
                            ),
                          ),
                        )
                      : Container(
                          color: theme.colorScheme.secondary
                              .withValues(alpha: 0.15),
                          child: Center(
                            child: Text(
                              community.nome.substring(0, 1).toUpperCase(),
                              style: TextStyle(
                                fontWeight: FontWeight.bold,
                                fontSize: 24,
                                color: theme.colorScheme.secondary,
                              ),
                            ),
                          ),
                        ),
                ),
              ),
              const SizedBox(width: 12),
              // Info
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      community.nome,
                      style: const TextStyle(
                          fontWeight: FontWeight.bold, fontSize: 16),
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                    ),
                    if (community.descricao != null) ...[
                      const SizedBox(height: 4),
                      Text(
                        community.descricao!,
                        maxLines: 2,
                        overflow: TextOverflow.ellipsis,
                        style: TextStyle(color: Colors.grey[600], fontSize: 13),
                      ),
                    ],
                    const SizedBox(height: 4),
                    Row(
                      children: [
                        Icon(Icons.people, size: 14, color: Colors.grey[500]),
                        const SizedBox(width: 4),
                        Text(
                          '${community.membrosCount} membros',
                          style:
                              TextStyle(color: Colors.grey[500], fontSize: 12),
                        ),
                      ],
                    ),
                  ],
                ),
              ),
              const SizedBox(width: 8),
              // Botão Entrar/Sair
              SizedBox(
                height: 34,
                child: community.isMembro
                    ? OutlinedButton(
                        onPressed: () => _toggleJoin(community),
                        style: OutlinedButton.styleFrom(
                          foregroundColor: Colors.grey[600],
                          side: BorderSide(color: Colors.grey[400]!),
                          padding: const EdgeInsets.symmetric(horizontal: 14),
                          shape: RoundedRectangleBorder(
                            borderRadius: BorderRadius.circular(20),
                          ),
                        ),
                        child: const Text('Membro',
                            style: TextStyle(fontSize: 12)),
                      )
                    : ElevatedButton(
                        onPressed: () => _toggleJoin(community),
                        style: ElevatedButton.styleFrom(
                          backgroundColor: theme.colorScheme.primary,
                          foregroundColor: Colors.white,
                          padding: const EdgeInsets.symmetric(horizontal: 14),
                          elevation: 0,
                          shape: RoundedRectangleBorder(
                            borderRadius: BorderRadius.circular(20),
                          ),
                        ),
                        child: const Text('Entrar',
                            style: TextStyle(fontSize: 12)),
                      ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
