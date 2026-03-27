import 'dart:io';
import 'package:flutter/material.dart';
import 'package:image_picker/image_picker.dart';
import 'package:lumem/services/dream_service.dart';

class CreateDream extends StatefulWidget {
  final String? communityId;

  const CreateDream({super.key, this.communityId});

  @override
  _CreateDreamState createState() => _CreateDreamState();
}

class _CreateDreamState extends State<CreateDream> {
  final TextEditingController _contentController = TextEditingController();
  final TextEditingController _hashtagController = TextEditingController();
  final DreamService _dreamService = DreamService();
  File? _image;
  bool _isPosting = false;
  final List<String> _hashtags = [];

  @override
  void dispose() {
    _contentController.dispose();
    _hashtagController.dispose();
    super.dispose();
  }

  Future<void> _pickImage() async {
    try {
      final picker = ImagePicker();
      final picked = await picker.pickImage(
        source: ImageSource.gallery,
        maxWidth: 1920,
        maxHeight: 1920,
        imageQuality: 85,
      );
      if (picked != null) {
        setState(() {
          _image = File(picked.path);
        });
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Erro ao selecionar imagem: $e')),
        );
      }
    }
  }

  void _addHashtag() {
    final tag = _hashtagController.text.trim();
    if (tag.isNotEmpty && !_hashtags.contains(tag)) {
      setState(() {
        _hashtags.add(tag);
        _hashtagController.clear();
      });
    }
  }

  Future<void> _postDream() async {
    if (_contentController.text.trim().isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Escreva algo sobre seu sonho!')),
      );
      return;
    }

    setState(() => _isPosting = true);

    final dream = await _dreamService.createDream(
      conteudoTexto: _contentController.text.trim(),
      hashtags: _hashtags.isNotEmpty ? _hashtags : null,
      imagem: _image,
      communityId: widget.communityId,
    );

    setState(() => _isPosting = false);

    if (dream != null) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Sonho publicado! ✨')),
        );
        Navigator.pop(context);
      }
    } else {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Erro ao publicar. Tente novamente.')),
        );
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Novo Sonho'),
        actions: [
          Padding(
            padding: const EdgeInsets.only(right: 8),
            child: _isPosting
                ? const Center(
                    child: SizedBox(
                      width: 20,
                      height: 20,
                      child: CircularProgressIndicator(strokeWidth: 2),
                    ),
                  )
                : TextButton(
                    onPressed: _postDream,
                    child: const Text(
                      'Publicar',
                      style: TextStyle(
                        fontWeight: FontWeight.bold,
                        fontSize: 16,
                      ),
                    ),
                  ),
          ),
        ],
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Dream content
            TextField(
              controller: _contentController,
              maxLines: 8,
              maxLength: 500,
              decoration: const InputDecoration(
                hintText: 'Conte sobre o seu sonho...',
                border: OutlineInputBorder(
                  borderRadius: BorderRadius.all(Radius.circular(16)),
                ),
                contentPadding: EdgeInsets.all(16),
                counterText: '', // Hide default counter
              ),
            ),
            Align(
              alignment: Alignment.centerRight,
              child: Padding(
                padding: const EdgeInsets.only(top: 4, right: 4),
                child: ValueListenableBuilder<TextEditingValue>(
                  valueListenable: _contentController,
                  builder: (context, value, _) {
                    final len = value.text.length;
                    final color = len > 450
                        ? Colors.red
                        : len > 350
                            ? Colors.orange
                            : Colors.grey;
                    return Text(
                      '$len/500',
                      style: TextStyle(color: color, fontSize: 12),
                    );
                  },
                ),
              ),
            ),
            const SizedBox(height: 16),

            // Hashtags input
            Row(
              children: [
                Expanded(
                  child: TextField(
                    controller: _hashtagController,
                    decoration: const InputDecoration(
                      hintText: 'Adicionar hashtag...',
                      prefixText: '#',
                      border: OutlineInputBorder(
                        borderRadius: BorderRadius.all(Radius.circular(16)),
                      ),
                      contentPadding:
                          EdgeInsets.symmetric(horizontal: 16, vertical: 12),
                    ),
                    onSubmitted: (_) => _addHashtag(),
                  ),
                ),
                const SizedBox(width: 8),
                IconButton(
                  onPressed: _addHashtag,
                  icon: const Icon(Icons.add_circle),
                  color: Theme.of(context).colorScheme.secondary,
                ),
              ],
            ),

            // Hashtag chips
            if (_hashtags.isNotEmpty) ...[
              const SizedBox(height: 8),
              Wrap(
                spacing: 8,
                children: _hashtags.map((tag) {
                  return Chip(
                    label: Text('#$tag'),
                    deleteIcon: const Icon(Icons.close, size: 16),
                    onDeleted: () {
                      setState(() => _hashtags.remove(tag));
                    },
                  );
                }).toList(),
              ),
            ],

            const SizedBox(height: 16),

            // Image picker
            OutlinedButton.icon(
              onPressed: _pickImage,
              icon: const Icon(Icons.image),
              label: const Text('Adicionar imagem'),
              style: OutlinedButton.styleFrom(
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(16),
                ),
                padding:
                    const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
              ),
            ),

            // Image preview
            if (_image != null) ...[
              const SizedBox(height: 12),
              Stack(
                alignment: Alignment.topRight,
                children: [
                  ClipRRect(
                    borderRadius: BorderRadius.circular(12),
                    child: Image.file(
                      _image!,
                      width: double.infinity,
                      height: 200,
                      fit: BoxFit.cover,
                    ),
                  ),
                  Positioned(
                    top: 8,
                    right: 8,
                    child: CircleAvatar(
                      radius: 16,
                      backgroundColor: Colors.black54,
                      child: IconButton(
                        icon: const Icon(Icons.close,
                            size: 16, color: Colors.white),
                        onPressed: () => setState(() => _image = null),
                      ),
                    ),
                  ),
                ],
              ),
            ],
          ],
        ),
      ),
    );
  }
}
