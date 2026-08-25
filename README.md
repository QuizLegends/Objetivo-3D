# 🦴 Bone Attacher

Editor 3D simples e funcional para anexar objetos (armas, acessórios, etc.) aos ossos de personagens 3D.

Funciona 100% no navegador. Basta subir no GitHub Pages.

## Como usar

1. Abra o site
2. Clique em **Importar Personagem** → escolha um arquivo `.glb`, `.gltf` ou `.fbx`
3. O esqueleto é detectado automaticamente
4. Vá na aba **Ossos** e clique no osso desejado (ex: `RightHand`, `mixamorig:RightHand`)
5. Clique em **Importar Objeto** → escolha a arma/acessório
6. Com o objeto selecionado + o osso selecionado, clique em **Anexar ao Osso**
7. Ajuste posição/rotação/escala com os gizmos (W / E / R) ou no painel de propriedades
8. Se o personagem tiver animações, clique nelas para reproduzir — o objeto acompanha o osso

## Controles

| Ação | Tecla / Botão |
|------|---------------|
| Mover | W |
| Rotacionar | E |
| Escalar | R |
| Focar selecionado | F |
| Alternar Local/World | Botão no toolbar |
| Anexar | Botão "Anexar ao Osso" |
| Desanexar | Botão "Desanexar" |

## Recursos

- Importação de personagens e objetos (GLB / GLTF / FBX)
- Detecção automática de Skeleton / Bones
- Anexação correta preservando transformação mundial
- Reprodução de animações (objeto segue o osso)
- TransformControls (mover, rotacionar, escalar)
- Painel de hierarquia e lista de ossos
- Propriedades editáveis
- Exportação GLB
- Interface dark profissional + responsiva (mobile)

## Como publicar no GitHub Pages

1. Crie um repositório novo no GitHub
2. Faça upload de todos os arquivos desta pasta
3. Vá em **Settings → Pages**
4. Source: Deploy from a branch → `main` → `/ (root)`
5. Aguarde alguns minutos e acesse `https://seu-usuario.github.io/nome-do-repo`

## Estrutura
