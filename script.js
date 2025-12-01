/* =========================
   Memória dos Direitos
   Firebase Realtime DB integration (compat)
   ========================= */

// ---------- CONFIGURE AQUI ----------
const firebaseConfig = {
  apiKey: "AIzaSyBieoXgRcq9MSrn6AP6JHMtwkWl18DZCHw",
  authDomain: "trabalho-ergonomia.firebaseapp.com",
  databaseURL: "https://trabalho-ergonomia-default-rtdb.firebaseio.com",
  projectId: "trabalho-ergonomia",
  storageBucket: "trabalho-ergonomia.firebasestorage.app",
  messagingSenderId: "50536456472",
  appId: "1:50536456472:web:7be9130c903d5464747e6d",
  measurementId: "G-35GTBZWGR3"
};
// Substitua pelos dados do seu projeto Firebase.

// ---------- Inicialização Firebase (compat) ----------
firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.database();

// login anônimo para permitir gravação (faça check das regras do DB)
auth.signInAnonymously().catch(err => {
  console.warn("Erro na autenticação anônima:", err.message);
});

// ---------- Dados do jogo (pares: situação + direito) ----------
const PAIRS = [
  {id:'p1', situation: 'Passe livre em transporte interestadual. 🚍', law: 'Passe livre em transporte interestadual. 🚍'},
  {id:'p2', situation: 'Inseção de imposto na compra de carro. 🚗', law: 'Inseção de imposto na compra de carro. 🚗'},
  {id:'p3', situation: 'Acessibilidade em prédios públicos. ♿️', law: 'Acessibilidade em prédios públicos. ♿️'},
  {id:'p4', situation: 'Desconto em eventos culturais. 🎭', law: 'Desconto em eventos culturais. 🎭'},
  {id:'p5', situation: 'Desconto em eventos esportivos. ⚽️', law: 'Desconto em eventos esportivos. ⚽️'},
  {id:'p6', situation: 'Prioridade em processos judiciais e administrativos. ⚖️', law: 'Prioridade em processos judiciais e administrativos. ⚖️'},
  {id:'p7', situation: 'Atendimento prioritário. ⏳', law: 'Atendimento prioritário. ⏳'},
  {id:'p8', situation: 'Isenção ou desconto em concursos públicos. 🎓', law: 'Isenção ou desconto em concursos públicos. 🎓'},
  {id:'p9', situation: 'Prioridade em programas habitacionais. 🏠', law: 'Prioridade em programas habitacionais. 🏠'},
  {id:'p10', situation: 'Desconto em medicamentos e tratamentos. 💊', law: 'Desconto em medicamentos e tratamentos. 💊'},
  {id:'p11', situation: 'Gratuidade em transporte municipal/metropolitano. 🚌', law: 'Gratuidade em transporte municipal/metropolitano. 🚌'},
  {id:'p12', situation: 'Isenção no pagamento de taxas de emissão de documentos. 📜', law: 'Isenção no pagamento de taxas de emissão de documentos. 📜'}
  // você pode adicionar/editar pares aqui
];

// ---------- DOM ----------
const boardEl = document.getElementById('board');
const timerEl = document.getElementById('timer');
const movesEl = document.getElementById('moves');
const matchedEl = document.getElementById('matched');
const totalPairsEl = document.getElementById('totalPairs');
const btnRestart = document.getElementById('btnRestart');
const btnNewGame = document.getElementById('btnNewGame');

const gameOverModal = document.getElementById('gameOver');
const finalTimeEl = document.getElementById('finalTime');
const finalMovesEl = document.getElementById('finalMoves');
const playerNameInput = document.getElementById('playerName');
const btnSaveScore = document.getElementById('btnSaveScore');
const btnCloseModal = document.getElementById('btnCloseModal');

const leaderboardList = document.getElementById('leaderboardList');
const btnToggleLeaderboard = document.getElementById('btnToggleLeaderboard');
const leaderboardEl = document.getElementById('leaderboard');

// ---------- Estado do jogo ----------
let deck = []; // cartas embaralhadas
let firstCard = null;
let secondCard = null;
let busy = false;
let matchedPairs = 0;
let totalPairs = PAIRS.length;
let moves = 0;

// Timer
let startTime = null;
let timerInterval = null;

// Ajustes do layout (número de colunas)
function adjustBoardGrid() {
  // Escolhe um grid apropriado conforme total de cartas
  const cardsCount = deck.length;
  boardEl.classList.remove('grid-4','grid-5','grid-6');
  if (cardsCount <= 12) boardEl.classList.add('grid-4');
  else if (cardsCount <= 20) boardEl.classList.add('grid-5');
  else boardEl.classList.add('grid-6');
}

// Cria e embaralha deck (cada par vira duas cartas: 'situation' e 'law')
function buildDeck() {
  const arr = [];
  PAIRS.forEach(p => {
    arr.push({pairId: p.id, kind: 'situation', text: p.situation});
    arr.push({pairId: p.id, kind: 'law', text: p.law});
  });
  // Fisher-Yates shuffle
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function renderBoard() {
  boardEl.innerHTML = '';
  deck.forEach((cardData, index) => {
    const card = document.createElement('div');
    card.className = 'card';
    card.dataset.index = index;
    card.dataset.pairId = cardData.pairId;
    card.tabIndex = 0;
    card.innerHTML = `
      <div class="card-inner">
        <div class="card-back">
          <strong>?</strong>
        </div>
        <div class="card-front">
          <div class="card-text">${escapeHtml(cardData.text)}</div>
        </div>
      </div>
    `;
    card.addEventListener('click', () => handleCardClick(card, cardData));
    boardEl.appendChild(card);
  });
  adjustBoardGrid();
  totalPairsEl.textContent = totalPairs;
}

// evita XSS simples ao inserir textos
function escapeHtml(s){
  return s.replace(/[&<>"']/g, function(m){ return ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":"&#39;"})[m]; });
}

// Lógica de clique
function handleCardClick(cardEl, cardData) {
  if (busy) return;
  if (cardEl.classList.contains('flipped') || cardEl.classList.contains('matched')) return;

  // inicia o timer no primeiro movimento
  if (!startTime) startTimer();

  cardEl.classList.add('flipped');

  if (!firstCard) {
    firstCard = {el: cardEl, data: cardData};
    return;
  }

  if (firstCard.el === cardEl) return; // clique na mesma carta

  secondCard = {el: cardEl, data: cardData};
  moves++;
  movesEl.textContent = moves;

  checkForMatch();
}

function checkForMatch() {
  const a = firstCard.data;
  const b = secondCard.data;
  busy = true;

  // são par se pairId igual e kinds são diferentes (situation vs law)
  if (a.pairId === b.pairId && a.kind !== b.kind) {
    // match
    setTimeout(() => {
      firstCard.el.classList.add('matched');
      secondCard.el.classList.add('matched');
      firstCard.el.querySelector('.card-front').classList.add('card-front-matched');
      secondCard.el.querySelector('.card-front').classList.add('card-front-matched');
      launchConfetti(firstCard.el);
      launchConfetti(secondCard.el);
      matchedPairs++;
      matchedEl.textContent = matchedPairs;
      resetSelection();
      busy = false;
      if (matchedPairs === totalPairs) gameWon();
    }, 450);
// Efeito confete melhorado
function launchConfetti(cardEl) {
  const confettiColors = ['#023635ff','#1c5440ff','#ae7c00ff','#ff3030ff','#4410b4ff','#c70a6cff'];
  const rect = cardEl.getBoundingClientRect();
  const centerX = rect.width / 2;
  const centerY = rect.height / 2;
  
  for (let i = 0; i < 30; i++) {
    const conf = document.createElement('div');
    conf.style.position = 'absolute';
    conf.style.left = centerX + 'px';
    conf.style.top = centerY + 'px';
    conf.style.width = (4 + Math.random() * 6) + 'px';
    conf.style.height = (4 + Math.random() * 6) + 'px';
    conf.style.borderRadius = Math.random() > 0.5 ? '50%' : '2px';
    conf.style.background = confettiColors[Math.floor(Math.random()*confettiColors.length)];
    conf.style.opacity = '1';
    conf.style.pointerEvents = 'none';
    conf.style.zIndex = '2';
    conf.style.transform = 'translate(-50%, -50%) scale(0)';
    conf.style.transition = 'all 1.2s cubic-bezier(.25,1,.5,1)';
    cardEl.appendChild(conf);

    // Random angle for explosion direction
    const angle = (Math.random() * 360) * (Math.PI / 180);
    const velocity = 25 + Math.random() * 60; // Velocidade um pouco menor para combinar com a animação mais lenta
    const deltaX = Math.cos(angle) * velocity;
    const deltaY = Math.sin(angle) * velocity;
    
    requestAnimationFrame(() => {
      conf.style.transform = `translate(
        calc(-50% + ${deltaX}px), 
        calc(-50% + ${deltaY}px)) 
        scale(${0.8 + Math.random() * 0.5}) 
        rotate(${Math.random() * 360}deg)`;
      conf.style.opacity = '0';
    });

    setTimeout(() => conf.remove(), 5900); // Aumentado o tempo de remoção para corresponder à animação mais longa
  }
}
  } else {
    // não é match
    setTimeout(() => {
      firstCard.el.classList.remove('flipped');
      secondCard.el.classList.remove('flipped');
      resetSelection();
      busy = false;
    }, 700);
  }
}

function resetSelection() {
  firstCard = null;
  secondCard = null;
}

function startTimer() {
  startTime = Date.now();
  timerInterval = setInterval(() => {
    const elapsed = Date.now() - startTime;
    timerEl.textContent = formatTime(elapsed);
  }, 200);
}

function stopTimer() {
  clearInterval(timerInterval);
  timerInterval = null;
}

function formatTime(ms) {
  const totalSec = Math.floor(ms / 1000);
  const min = Math.floor(totalSec / 60).toString().padStart(2,'0');
  const sec = (totalSec % 60).toString().padStart(2,'0');
  return `${min}:${sec}`;
}

// iniciar jogo
function startGame(newShuffle = true) {
  stopTimer();
  startTime = null;
  timerEl.textContent = '00:00';
  moves = 0;
  movesEl.textContent = moves;
  matchedPairs = 0;
  matchedEl.textContent = matchedPairs;
  totalPairs = PAIRS.length;
  totalPairsEl.textContent = totalPairs;

  deck = buildDeck();
  renderBoard();
}

// Reiniciar (mantém mesmo embaralhamento)
btnRestart.addEventListener('click', () => {
  // re-render com o mesmo deck, resetando estados
  stopTimer();
  startTime = null;
  timerEl.textContent = '00:00';
  moves = 0;
  movesEl.textContent = moves;
  matchedPairs = 0;
  matchedEl.textContent = matchedPairs;

  document.querySelectorAll('.card').forEach(c => {
    c.classList.remove('flipped','matched');
  });
  firstCard = null;
  secondCard = null;
  busy = false;
});

// Novo jogo (embaralha)
btnNewGame.addEventListener('click', () => startGame(true));

// fim do jogo
function gameWon() {
  stopTimer();
  const elapsedMs = Date.now() - startTime;
  finalTimeEl.textContent = formatTime(elapsedMs);
  finalMovesEl.textContent = moves;
  gameOverModal.classList.remove('hidden');

  // preenche sugestão de nome
  playerNameInput.value = localStorage.getItem('lastPlayerName') || '';
}

// fechar modal
btnCloseModal.addEventListener('click', () => {
  gameOverModal.classList.add('hidden');
});

// salvar score no Firebase
btnSaveScore.addEventListener('click', async () => {
  const name = (playerNameInput.value || 'Anônimo').trim();
  localStorage.setItem('lastPlayerName', name);
  const elapsedMs = Date.now() - startTime;
  const timeSec = Math.floor(elapsedMs / 1000);

  const score = {
    name,
    time: timeSec,
    moves,
    timestamp: firebase.database.ServerValue.TIMESTAMP
  };

  try {
    // grava no nó /rankings
    await db.ref('rankings').push(score);
    gameOverModal.classList.add('hidden');
    fetchLeaderboard();
  } catch (err) {
    alert('Erro ao salvar no Firebase: ' + err.message);
  }
});

// busca ranking (top 10 ordenado por tempo e moves)
async function fetchLeaderboard() {
  // lê todos os registros e ordena localmente
  const snapshot = await db.ref('rankings').once('value');
  const items = [];
  snapshot.forEach(child => {
    const v = child.val();
    items.push({ key: child.key, ...v });
  });

  // ordena: tempo asc, moves asc, timestamp asc
  items.sort((a,b) => {
    if (a.time !== b.time) return a.time - b.time;
    if (a.moves !== b.moves) return a.moves - b.moves;
    return (a.timestamp || 0) - (b.timestamp || 0);
  });

  leaderboardList.innerHTML = '';
  items.slice(0,10).forEach((it, idx) => {
    const li = document.createElement('li');
    li.textContent = `${it.name} — ${formatTime(it.time*1000)} • ${it.moves} mov.`;
    leaderboardList.appendChild(li);
  });

  if (items.length === 0) {
    leaderboardList.innerHTML = '<li>Nenhum recorde salvo ainda.</li>';
  }
}

// Start
startGame(true);
fetchLeaderboard();

// Toggle da leaderboard: mostra / esconde e atualiza aria-expanded
if (btnToggleLeaderboard && leaderboardEl) {
  btnToggleLeaderboard.addEventListener('click', () => {
    const wasHidden = leaderboardEl.classList.toggle('hidden');
    // btn aria
    btnToggleLeaderboard.setAttribute('aria-expanded', (!wasHidden).toString());
    leaderboardEl.setAttribute('aria-hidden', wasHidden.toString());
    btnToggleLeaderboard.textContent = wasHidden ? 'Top jogadores' : 'Fechar ranking';
    if (!wasHidden) {
      // atualizar lista sempre que abrir
      fetchLeaderboard();
    }
  });
}

/* Optional: allow pressing Enter to flip focused card (keyboard support) */
boardEl.addEventListener('keydown', (ev) => {
  const t = ev.target;
  if (t.classList && t.classList.contains('card') && (ev.key === 'Enter' || ev.key === ' ')) {
    t.click();
    ev.preventDefault();
  }
});
