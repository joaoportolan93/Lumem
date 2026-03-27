import 'package:flutter/material.dart';
import 'package:cached_network_image/cached_network_image.dart';
import 'package:lumem/models/dream.dart';
import 'package:lumem/services/dream_service.dart';
import 'package:lumem/views/screens/dream_detail.dart';
import 'package:timeago/timeago.dart' as timeago;

class DreamCard extends StatefulWidget {
  final Dream dream;
  final VoidCallback? onUpdate;

  const DreamCard({super.key, required this.dream, this.onUpdate});

  @override
  _DreamCardState createState() => _DreamCardState();
}

class _DreamCardState extends State<DreamCard> {
  late bool _isLiked;
  late int _likesCount;
  late bool _isSaved;
  final DreamService _dreamService = DreamService();

  @override
  void initState() {
    super.initState();
    _isLiked = widget.dream.isLiked;
    _likesCount = widget.dream.curtidasCount;
    _isSaved = widget.dream.isSaved;
  }

  @override
  Widget build(BuildContext context) {
    final dream = widget.dream;

    return Card(
      margin: const EdgeInsets.only(bottom: 16),
      elevation: 1,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
      child: InkWell(
        borderRadius: BorderRadius.circular(16),
        onTap: () {
          Navigator.push(
            context,
            MaterialPageRoute(
              builder: (_) => DreamDetail(dreamId: dream.id),
            ),
          ).then((_) => widget.onUpdate?.call());
        },
        child: Padding(
          padding: const EdgeInsets.all(16),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              // Header: avatar + name + time
              Row(
                children: [
                  CircleAvatar(
                    radius: 20,
                    backgroundImage: dream.usuario?.avatar != null
                        ? CachedNetworkImageProvider(dream.usuario!.avatar!)
                        : null,
                    child: dream.usuario?.avatar == null
                        ? Text(
                            dream.usuario?.nomeUsuario
                                    .substring(0, 1)
                                    .toUpperCase() ??
                                '?',
                            style: const TextStyle(fontWeight: FontWeight.bold),
                          )
                        : null,
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          dream.usuario?.nomeCompleto ?? dream.usuario?.nomeUsuario ?? 'Anônimo',
                          style: const TextStyle(
                            fontWeight: FontWeight.bold,
                            fontSize: 15,
                          ),
                        ),
                        Text(
                          '@${dream.usuario?.nomeUsuario ?? ''} · ${timeago.format(dream.dataPublicacao, locale: 'pt_BR')}',
                          style: TextStyle(
                            color: Colors.grey[500],
                            fontSize: 12,
                          ),
                        ),
                      ],
                    ),
                  ),
                  if (dream.comunidadeNome != null)
                    Container(
                      padding: const EdgeInsets.symmetric(
                          horizontal: 8, vertical: 4),
                      decoration: BoxDecoration(
                        color: Theme.of(context)
                            .colorScheme
                            .secondary
                            .withValues(alpha: 0.1),
                        borderRadius: BorderRadius.circular(12),
                      ),
                      child: Text(
                        dream.comunidadeNome!,
                        style: TextStyle(
                          fontSize: 11,
                          color: Theme.of(context).colorScheme.secondary,
                        ),
                      ),
                    ),
                  if (dream.isOwner)
                    PopupMenuButton<String>(
                      icon: const Icon(Icons.more_vert, size: 18, color: Colors.grey),
                      onSelected: (value) {
                        if (value == 'delete') _confirmDelete();
                      },
                      itemBuilder: (_) => [
                        const PopupMenuItem(
                          value: 'delete',
                          child: Row(
                            children: [
                              Icon(Icons.delete_outline, color: Colors.red, size: 18),
                              SizedBox(width: 8),
                              Text('Excluir post', style: TextStyle(color: Colors.red)),
                            ],
                          ),
                        ),
                      ],
                    ),
                ],
              ),
              const SizedBox(height: 12),

              // Dream text content
              Text(
                dream.conteudoTexto,
                style: const TextStyle(fontSize: 15, height: 1.4),
                maxLines: 5,
                overflow: TextOverflow.ellipsis,
              ),

              // Hashtags
              if (dream.hashtags.isNotEmpty) ...[
                const SizedBox(height: 8),
                Wrap(
                  spacing: 6,
                  children: dream.hashtags.map((tag) {
                    final text = tag.startsWith('#') ? tag : '#$tag';
                    return Text(
                      text,
                      style: TextStyle(
                        color: Theme.of(context).colorScheme.secondary,
                        fontWeight: FontWeight.w500,
                        fontSize: 13,
                      ),
                    );
                  }).toList(),
                ),
              ],

              // Image (if any)
              if (dream.imagem != null) ...[
                const SizedBox(height: 12),
                ClipRRect(
                  borderRadius: BorderRadius.circular(12),
                  child: CachedNetworkImage(
                    imageUrl: dream.imagem!,
                    width: double.infinity,
                    height: 200,
                    fit: BoxFit.cover,
                    placeholder: (_, __) => Container(
                      height: 200,
                      color: Colors.grey[200],
                      child: const Center(child: CircularProgressIndicator()),
                    ),
                    errorWidget: (_, __, ___) => Container(
                      height: 200,
                      color: Colors.grey[200],
                      child: const Icon(Icons.broken_image, size: 48),
                    ),
                  ),
                ),
              ],

              const SizedBox(height: 12),

              // Action buttons: like, comment, save
              Row(
                children: [
                  // Like button
                  InkWell(
                    onTap: _toggleLike,
                    borderRadius: BorderRadius.circular(20),
                    child: Padding(
                      padding: const EdgeInsets.all(4),
                      child: Row(
                        children: [
                          Icon(
                            _isLiked ? Icons.favorite : Icons.favorite_border,
                            color: _isLiked ? Colors.red : Colors.grey,
                            size: 22,
                          ),
                          const SizedBox(width: 4),
                          Text(
                            '$_likesCount',
                            style: TextStyle(
                              color: Colors.grey[600],
                              fontSize: 13,
                            ),
                          ),
                        ],
                      ),
                    ),
                  ),
                  const SizedBox(width: 16),

                  // Comment button
                  Row(
                    children: [
                      const Icon(Icons.chat_bubble_outline,
                          color: Colors.grey, size: 20),
                      const SizedBox(width: 4),
                      Text(
                        '${dream.comentariosCount}',
                        style: TextStyle(
                          color: Colors.grey[600],
                          fontSize: 13,
                        ),
                      ),
                    ],
                  ),
                  const Spacer(),

                  // Save button
                  InkWell(
                    onTap: _toggleSave,
                    borderRadius: BorderRadius.circular(20),
                    child: Padding(
                      padding: const EdgeInsets.all(4),
                      child: Icon(
                        _isSaved ? Icons.bookmark : Icons.bookmark_border,
                        color: _isSaved
                            ? Theme.of(context).colorScheme.secondary
                            : Colors.grey,
                        size: 22,
                      ),
                    ),
                  ),
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }

  Future<void> _toggleLike() async {
    setState(() {
      _isLiked = !_isLiked;
      _likesCount = (_likesCount + (_isLiked ? 1 : -1))
          .clamp(0, double.maxFinite.toInt());
    });

    final success = await _dreamService.likeDream(widget.dream.id);
    if (!success) {
      // Revert on failure
      setState(() {
        _isLiked = !_isLiked;
        _likesCount = (_likesCount + (_isLiked ? 1 : -1))
            .clamp(0, double.maxFinite.toInt());
      });
    }
  }

  Future<void> _toggleSave() async {
    setState(() {
      _isSaved = !_isSaved;
    });

    final success = await _dreamService.saveDream(widget.dream.id);
    if (!success) {
      setState(() {
        _isSaved = !_isSaved;
      });
    }
  }

  Future<void> _confirmDelete() async {
    final confirm = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Excluir post'),
        content: const Text('Tem certeza que deseja excluir este sonho? Esta ação não pode ser desfeita.'),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx, false),
            child: const Text('Cancelar'),
          ),
          TextButton(
            onPressed: () => Navigator.pop(ctx, true),
            child: const Text('Excluir', style: TextStyle(color: Colors.red)),
          ),
        ],
      ),
    );

    if (confirm == true) {
      final success = await _dreamService.deleteDream(widget.dream.id);
      if (success) {
        widget.onUpdate?.call();
      } else if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('Erro ao excluir post.'),
            backgroundColor: Colors.red,
          ),
        );
      }
    }
  }
}
