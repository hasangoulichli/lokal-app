const fs = require('fs');

const path = 'src/components/restaurant/OrderCard.jsx';
let content = fs.readFileSync(path, 'utf8');

content = content.replace(
  /const mins = minutesAgo\(order\.created_date\);\n  const isUrgent = mins >= 10;\n  const \[completing, setCompleting\] = useState\(false\);\n\n  \/\/ ÇÖKMEYİ ÖNLEYEN ZIRH: Eğer order nesnesi veya items dizisi yoksa kart boş döner\n  if \(\!order \|\| \!order\.items \|\| \!Array\.isArray\(order\.items\)\) \{\n    return null;\n  \}/,
  `const [completing, setCompleting] = useState(false);

  // ÇÖKMEYİ ÖNLEYEN ZIRH: Eğer order nesnesi veya items dizisi yoksa kart boş döner
  if (!order || !order.items || !Array.isArray(order.items)) {
    return null;
  }

  const mins = minutesAgo(order.created_date);
  const isUrgent = mins >= 10;`
);

fs.writeFileSync(path, content);
