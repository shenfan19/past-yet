# TP 员工立绘

选自现有的开局候选员工。年龄与职业沿用员工卡，发型、服饰、配色和道具外观为本组新增设计。每张立绘都是独立的 1024 × 1536 透明背景 PNG，文件名与员工 ID 对应。

## 外形设计

- [陈美玲](s_meiling.png)。台南出身的美术生，19 岁。齐下巴短发别着红发夹，米白衬衫配朱红背心，袖口沾了一抹颜料。抱着画了庙宇的速写簿，抬眼看下一处细节。
- [汤姆·贝克](s_tom.png)。俄亥俄州的修理学徒兼农场帮工，18 岁。肩膀宽，脸上有雀斑，浅棕头发翘着。褪色的牛仔背带裤塞着擦油布，手里的扳手和憨笑很好认。
- [贾马尔·惠特菲尔德](s_jamal.png)。亚特兰大的夜班急救员，36 岁。短卷发、修齐的胡须，身形结实。深靛蓝值班服带薄荷绿反光条，手提青绿色急救箱，站姿松弛，神情让人安心。
- [朴敏智](s_minji.png)。釜山的厨师兼摊主，45 岁。带几缕灰发的低发髻，笑起来眼角有纹。梅紫衬衫挽到肘上，砖红围裙别着布巾，手里攥着盛汤的长勺。
- [艾格丽姆·苏尔塔诺娃](s_aigerim.png)。哈萨克族野外地质学家，37 岁。粗眉、低辫，穿打过补丁的赭黄防风衣和沾尘的登山靴。斜挎帆布包，手里的野外笔记本夹着一页待查记录。

## 生成记录

使用内置 ImageGen，根据员工卡为虚构角色生成。提示词由下方统一画风与对应员工描述组合，开启透明背景。

### 统一画风

```text
Stylized-concept illustration, single full-body original fictional employee for a historical time-travel staffing agency web game. Cohesive approachable 2D indie game character art, expressive natural face, subtly simplified realistic adult proportions, hand-inked textured edges and matte gouache color blocks, limited warm palette with one dominant accent. Centered standing three-quarter pose, full head and shoes visible with generous clear margins, front-side soft light, clean readable silhouette at small sizes. Portrait-oriented canvas, genuinely transparent background, no scenery, lettering, brand, logo, signature, border, or watermark. One person and only the described props.
```

### s_meiling

```text
Mei-Ling Chen, 19, Taiwanese art student from Tainan. Slim with a thoughtful alert gaze, light warm complexion and black chin-length bob, one side pinned back with a single red hair clip. Pale cream work shirt layered under a vermilion cropped vest, charcoal loose trousers, canvas sneakers. An open strap-bound sketchbook held close and a red pencil in her other hand, a small vermilion pigment smudge on her cuff. The dominant accent is temple-door red.
```

### s_tom

```text
Tom Becker, 18, broad-shouldered young mechanic apprentice and farmhand from Ohio. Fair complexion, scattered freckles, rumpled sandy hair with a cowlick, bashful half-grin. Faded denim-blue work overalls with rolled cuffs over a warm ivory T-shirt, scuffed brown work boots. One large ring spanner upright in his hand and a grease rag tucked in a pocket. Youthful but adult. Denim blue dominant.
```

### s_jamal

```text
Jamal Whitfield, 36, Black American night-shift paramedic from Atlanta, deep brown complexion, short tightly curled hair with a neat fade and trimmed beard, broad build and reassuring warm gaze. Dark indigo zippered unbranded shift jacket with narrow mint reflective piping, matching cargo trousers, sturdy black shoes. Compact teal medical kit with a simple geometric clasp, no emblems, held low by the handle. Relaxed open posture. Deep indigo and mint accent.
```

### s_minji

```text
Min-ji Park, 45, Korean cook and stall owner from Busan, light warm skin, rounded strong face with smile lines, black hair with a few greys in a low bun. Broad grounded silhouette, sleeves of a dusty plum shirt rolled above elbows, dark red-brown waist apron over dark trousers and comfortable clogs. A single stainless-steel soup ladle held near her hip and a folded cream hand towel attached to apron. Plum and red-brown accent.
```

### s_aigerim

```text
Aigerim Sultanova, 37, Kazakh field geologist trained in Almaty. Wind-weathered light-medium complexion, dark thick eyebrows and dark brown hair in a single low braid, self-possessed curious expression. Ochre windbreaker with a visible repair patch, olive field trousers and dusty hiking boots, compact crossbody canvas satchel and small field notebook held in one hand with a plain unlabeled tab. Amber ochre accent.
```

