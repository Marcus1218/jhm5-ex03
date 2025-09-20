// 井字遊戲類定義，包含所有遊戲邏輯和功能
class TicTacToe {
    // 構造函數，初始化遊戲的基本屬性和狀態
    constructor() {
        this.board = ['', '', '', '', '', '', '', '', '']; // 初始化9格棋盤陣列，空字符串表示空格
        this.currentPlayer = 'X'; // 設置當前玩家為X（玩家一先手）
        this.gameMode = 'ai'; // 設置遊戲模式為AI對戰（'ai' 或 'human'）
        this.gameActive = true; // 遊戲是否進行中的狀態標記
        this.isAiTurn = false; // AI是否正在思考的狀態標記，防止玩家在AI回合操作

        // 定義所有可能的獲勝組合（3個連線的位置組合）
        this.winningCombinations = [
            [0, 1, 2], [3, 4, 5], [6, 7, 8], // 橫排三種組合
            [0, 3, 6], [1, 4, 7], [2, 5, 8], // 直排三種組合
            [0, 4, 8], [2, 4, 6] // 對角線兩種組合
        ];

        this.initializeGame(); // 調用初始化函數開始遊戲設置
    }

    // 初始化遊戲的主要函數
    initializeGame() {
        this.bindEvents(); // 綁定所有事件監聽器
        this.updateDisplay(); // 更新界面顯示
    }

    // 綁定所有用戶交互事件的函數
    bindEvents() {
        // 遊戲模式切換事件綁定
        document.getElementById('humanVsAi').addEventListener('click', () => {
            this.setGameMode('ai'); // 點擊時切換到AI對戰模式
        });

        document.getElementById('humanVsHuman').addEventListener('click', () => {
            this.setGameMode('human'); // 點擊時切換到雙人對戰模式
        });

        // 為每個棋盤格子綁定點擊事件
        document.querySelectorAll('.cell').forEach(cell => {
            cell.addEventListener('click', (e) => {
                const index = parseInt(e.target.dataset.cellIndex); // 獲取被點擊格子的索引
                this.makeMove(index); // 執行下棋動作
            });
        });

        // 重置遊戲按鈕事件綁定
        document.getElementById('resetBtn').addEventListener('click', () => {
            this.resetGame(); // 點擊時重置整個遊戲
        });

        // 再玩一局按鈕事件綁定（在勝利模態框中）
        document.getElementById('playAgainBtn').addEventListener('click', () => {
            this.resetGame(); // 重置遊戲狀態
            this.hideVictoryModal(); // 隱藏勝利彈窗
        });
    }

    // 設置遊戲模式的函數
    setGameMode(mode) {
        this.gameMode = mode; // 更新遊戲模式
        this.resetGame(); // 重置遊戲以應用新模式

        // 更新模式選擇按鈕的視覺狀態
        document.querySelectorAll('.mode-btn').forEach(btn => {
            btn.classList.remove('active'); // 移除所有按鈕的active類
        });

        // 根據選擇的模式更新界面
        if (mode === 'ai') {
            document.getElementById('humanVsAi').classList.add('active'); // 高亮AI對戰按鈕
            document.getElementById('player2Name').textContent = '電腦'; // 顯示玩家二為電腦
        } else {
            document.getElementById('humanVsHuman').classList.add('active'); // 高亮雙人對戰按鈕
            document.getElementById('player2Name').textContent = '玩家二'; // 顯示玩家二為玩家二
        }
    }

    // 執行下棋動作的主要函數
    makeMove(index) {
        // 檢查是否可以下棋：遊戲進行中、格子為空、不是AI思考時間
        if (!this.gameActive || this.board[index] !== '' || this.isAiTurn) {
            return; // 如果條件不滿足則退出函數
        }

        this.board[index] = this.currentPlayer; // 在棋盤陣列中記錄當前玩家的棋子
        this.updateCell(index, this.currentPlayer); // 更新界面上對應格子的顯示

        // 檢查是否有玩家獲勝
        if (this.checkWin()) {
            this.endGame(this.currentPlayer); // 如果獲勝則結束遊戲
            return; // 退出函數
        }

        // 檢查是否平局（所有格子都被填滿）
        if (this.checkDraw()) {
            this.endGame('draw'); // 如果平局則結束遊戲
            return; // 退出函數
        }

        this.switchPlayer(); // 切換到下一個玩家

        // 如果是AI模式且輪到O（電腦），執行AI移動
        if (this.gameMode === 'ai' && this.currentPlayer === 'O') {
            this.isAiTurn = true; // 標記AI正在思考
            setTimeout(() => { // 延遲執行讓AI看起來在思考
                this.makeAiMove(); // 執行AI的下棋邏輯
                this.isAiTurn = false; // 標記AI思考結束
            }, 500); // 延遲500毫秒
        }
    }

    // AI下棋的函數
    makeAiMove() {
        if (!this.gameActive) return; // 如果遊戲已結束則不執行

        const bestMove = this.minimax(this.board, 'O').index; // 使用minimax算法計算最佳落子位置

        // 如果找到有效的移動位置
        if (bestMove !== undefined) {
            this.board[bestMove] = 'O'; // 在棋盤陣列中記錄AI的棋子
            this.updateCell(bestMove, 'O'); // 更新界面顯示

            // 檢查AI是否獲勝
            if (this.checkWin()) {
                this.endGame('O'); // AI獲勝時結束遊戲
                return; // 退出函數
            }

            // 檢查是否平局
            if (this.checkDraw()) {
                this.endGame('draw'); // 平局時結束遊戲
                return; // 退出函數
            }

            this.switchPlayer(); // 切換回玩家
        }
    }

    // Minimax算法實現，用於AI決策最佳落子位置
    minimax(board, player) {
        const availableMoves = this.getAvailableMoves(board); // 獲取所有可用的移動位置

        // 檢查遊戲終端狀態（勝負或平局）
        if (this.checkWinForBoard(board, 'O')) {
            return { score: 10 }; // AI獲勝返回正分
        } else if (this.checkWinForBoard(board, 'X')) {
            return { score: -10 }; // 玩家獲勝返回負分
        } else if (availableMoves.length === 0) {
            return { score: 0 }; // 平局返回0分
        }

        const moves = []; // 存儲所有可能移動的評分

        // 遍歷所有可能的移動
        for (let i = 0; i < availableMoves.length; i++) {
            const move = {}; // 創建移動對象
            move.index = availableMoves[i]; // 記錄移動位置

            board[availableMoves[i]] = player; // 在棋盤上模擬放置棋子

            // 遞歸調用minimax評估這步移動
            if (player === 'O') {
                const result = this.minimax(board, 'X'); // AI回合，下一步是玩家
                move.score = result.score; // 記錄評分
            } else {
                const result = this.minimax(board, 'O'); // 玩家回合，下一步是AI
                move.score = result.score; // 記錄評分
            }

            board[availableMoves[i]] = ''; // 撤銷模擬的移動
            moves.push(move); // 將移動加入列表
        }

        let bestMove; // 最佳移動變量
        // 根據當前玩家選擇最佳移動
        if (player === 'O') {
            let bestScore = -10000; // AI尋找最高分
            for (let i = 0; i < moves.length; i++) {
                if (moves[i].score > bestScore) {
                    bestScore = moves[i].score; // 更新最高分
                    bestMove = i; // 記錄最佳移動索引
                }
            }
        } else {
            let bestScore = 10000; // 玩家尋找最低分（對AI最不利）
            for (let i = 0; i < moves.length; i++) {
                if (moves[i].score < bestScore) {
                    bestScore = moves[i].score; // 更新最低分
                    bestMove = i; // 記錄最佳移動索引
                }
            }
        }

        return moves[bestMove]; // 返回最佳移動
    }

    // 獲取棋盤上所有空位置的函數
    getAvailableMoves(board) {
        // 將棋盤映射為索引，過濾出空位置
        return board.map((cell, index) => cell === '' ? index : null).filter(val => val !== null);
    }

    // 檢查指定棋盤和玩家是否獲勝的函數
    checkWinForBoard(board, player) {
        // 檢查是否有任何獲勝組合被該玩家完成
        return this.winningCombinations.some(combination => {
            return combination.every(index => board[index] === player);
        });
    }

    // 更新界面上棋盤格子顯示的函數
    updateCell(index, player) {
        const cell = document.querySelector(`[data-cell-index="${index}"]`); // 獲取對應的DOM元素
        cell.textContent = player; // 顯示玩家符號（X或O）
        cell.classList.add(player.toLowerCase()); // 添加樣式類用於視覺效果
        cell.classList.add('taken'); // 標記該格子已被占用

        // 添加放置動畫效果
        cell.style.animation = 'none'; // 重置動畫
        cell.offsetHeight; // 強制瀏覽器重新計算佈局
        cell.style.animation = 'pulse 0.3s ease'; // 應用脈衝動畫
    }

    // 檢查當前玩家是否獲勝的函數
    checkWin() {
        // 尋找當前玩家是否完成了任何獲勝組合
        const winningCombination = this.winningCombinations.find(combination => {
            return combination.every(index => this.board[index] === this.currentPlayer);
        });

        // 如果找到獲勝組合
        if (winningCombination) {
            // 高亮顯示獲勝的格子
            winningCombination.forEach(index => {
                document.querySelector(`[data-cell-index="${index}"]`).classList.add('winning');
            });
            return true; // 返回獲勝狀態
        }

        return false; // 沒有獲勝
    }

    // 檢查是否平局的函數
    checkDraw() {
        return this.board.every(cell => cell !== ''); // 所有格子都被填滿則為平局
    }

    // 切換當前玩家的函數
    switchPlayer() {
        this.currentPlayer = this.currentPlayer === 'X' ? 'O' : 'X'; // 在X和O之間切換
        this.updateDisplay(); // 更新界面顯示
    }

    // 更新遊戲界面顯示的函數
    updateDisplay() {
        const currentTurnElement = document.getElementById('currentTurn'); // 獲取回合提示元素
        if (this.gameActive) { // 如果遊戲正在進行
            if (this.gameMode === 'ai') { // AI模式下的顯示
                if (this.currentPlayer === 'X') {
                    currentTurnElement.textContent = '輪到您下棋'; // 玩家回合
                } else {
                    currentTurnElement.textContent = '電腦思考中...'; // AI思考中
                }
            } else { // 雙人模式下的顯示
                currentTurnElement.textContent = `輪到 ${this.currentPlayer} 玩家`; // 顯示當前玩家
            }
        }
    }

    // 結束遊戲的函數
    endGame(winner) {
        this.gameActive = false; // 標記遊戲結束
        const statusElement = document.getElementById('gameStatus'); // 獲取狀態顯示元素

        if (winner === 'draw') { // 平局情況
            statusElement.textContent = '平局！'; // 顯示平局信息
            statusElement.className = 'status-draw'; // 添加平局樣式
            this.showVictoryModal('平局！'); // 顯示平局模態框
        } else { // 有玩家獲勝
            let message; // 勝利消息變量
            if (this.gameMode === 'ai') { // AI模式下的勝利處理
                if (winner === 'X') {
                    message = '恭喜您獲勝！'; // 玩家獲勝消息
                    statusElement.textContent = '您贏了！'; // 狀態顯示
                } else {
                    message = '電腦獲勝！再試一次吧！'; // AI獲勝消息
                    statusElement.textContent = '電腦贏了！'; // 狀態顯示
                }
            } else { // 雙人模式下的勝利處理
                message = `恭喜 ${winner} 玩家獲勝！`; // 獲勝玩家消息
                statusElement.textContent = `${winner} 玩家獲勝！`; // 狀態顯示
            }

            statusElement.className = 'status-win'; // 添加獲勝樣式
            this.showVictoryModal(message); // 顯示勝利模態框

            // 只有玩家獲勝時才顯示煙火慶祝動畫
            if (this.gameMode === 'human' || winner === 'X') {
                this.createFireworks(); // 創建煙火效果
            }
        }

        document.getElementById('currentTurn').textContent = '遊戲結束'; // 更新回合提示
    }

    // 顯示勝利模態框的函數
    showVictoryModal(message) {
        const modal = document.getElementById('victoryModal'); // 獲取模態框元素
        const messageElement = document.getElementById('victoryMessage'); // 獲取消息元素
        messageElement.textContent = message; // 設置顯示消息
        modal.classList.add('show'); // 添加顯示類來顯示模態框
    }

    // 隱藏勝利模態框的函數
    hideVictoryModal() {
        const modal = document.getElementById('victoryModal'); // 獲取模態框元素
        modal.classList.remove('show'); // 移除顯示類來隱藏模態框
    }

    // 創建煙火慶祝效果的函數
    createFireworks() {
        const container = document.getElementById('fireworksContainer'); // 獲取煙火容器
        if (!container) { // 如果容器不存在
            console.error('Fireworks container not found!'); // 輸出錯誤信息
            return; // 退出函數
        }

        const colors = ['#ff6b6b', '#4834d4', '#ffd700', '#00cec9', '#fd79a8', '#fdcb6e']; // 煙火顏色陣列

        console.log('Creating fireworks!'); // 調試信息輸出

        // 創建多個煙火爆炸點
        for (let i = 0; i < 8; i++) { // 循環8次創建8個爆炸
            setTimeout(() => { // 延時創建每個爆炸
                this.createFireworkExplosion(container, colors); // 創建單次爆炸效果
            }, i * 200); // 每200毫秒創建一個
        }

        // 8秒後清理所有煙火效果
        setTimeout(() => {
            container.innerHTML = ''; // 清空容器內容
        }, 8000); // 8秒延遲
    }

    // 創建單次煙火爆炸效果的函數
    createFireworkExplosion(container, colors) {
        // 生成隨機爆炸位置
        const x = Math.random() * window.innerWidth; // 隨機X座標
        const y = Math.random() * (window.innerHeight * 0.6) + (window.innerHeight * 0.1); // 隨機Y座標（限制在螢幕上方60%）

        // 創建爆炸中心點元素
        const explosion = document.createElement('div'); // 創建DOM元素
        explosion.className = 'firework-explosion'; // 設置CSS類名
        explosion.style.left = x + 'px'; // 設置X位置
        explosion.style.top = y + 'px'; // 設置Y位置

        // 創建30個粒子效果
        for (let i = 0; i < 30; i++) {
            const particle = document.createElement('div'); // 創建粒子元素
            particle.className = 'firework-particle'; // 設置粒子CSS類名

            // 隨機選擇粒子顏色
            const color = colors[Math.floor(Math.random() * colors.length)]; // 從顏色陣列隨機選擇
            particle.style.backgroundColor = color; // 設置背景顏色
            particle.style.boxShadow = `0 0 6px ${color}`; // 設置發光效果

            // 計算粒子飛散的方向和速度
            const angle = (Math.PI * 2 * i) / 30; // 計算角度（360度平均分配）
            const velocity = Math.random() * 100 + 50; // 隨機速度（50-150）
            const vx = Math.cos(angle) * velocity; // X軸速度分量
            const vy = Math.sin(angle) * velocity; // Y軸速度分量

            // 設置粒子初始位置
            particle.style.left = '0px'; // 相對於爆炸中心
            particle.style.top = '0px'; // 相對於爆炸中心

            // 將粒子添加到爆炸中心
            explosion.appendChild(particle); // 加入DOM樹

            // 延遲開始粒子動畫
            setTimeout(() => {
                particle.style.transform = `translate(${vx}px, ${vy}px)`; // 移動粒子
                particle.style.opacity = '0'; // 淡出效果
            }, 10); // 10毫秒延遲
        }

        container.appendChild(explosion); // 將整個爆炸效果加入容器

        // 2秒後清理這個爆炸效果
        setTimeout(() => {
            if (explosion.parentNode) { // 如果元素仍在DOM中
                explosion.parentNode.removeChild(explosion); // 移除元素
            }
        }, 2000); // 2秒延遲
    }

    // 重置遊戲到初始狀態的函數
    resetGame() {
        this.board = ['', '', '', '', '', '', '', '', '']; // 重置棋盤陣列
        this.currentPlayer = 'X'; // 重置當前玩家為X
        this.gameActive = true; // 重置遊戲為進行狀態
        this.isAiTurn = false; // 重置AI狀態

        // 清理所有棋盤格子的顯示和樣式
        document.querySelectorAll('.cell').forEach(cell => {
            cell.textContent = ''; // 清空格子內容
            cell.className = 'cell'; // 重置為基本CSS類
            cell.style.animation = ''; // 清除動畫
        });

        // 清理遊戲狀態顯示
        const statusElement = document.getElementById('gameStatus'); // 獲取狀態元素
        if (statusElement) { // 如果元素存在
            statusElement.textContent = ''; // 清空狀態文字
            statusElement.className = ''; // 清除狀態樣式類
        }

        // 清理煙火效果
        const fireworksContainer = document.getElementById('fireworksContainer'); // 獲取煙火容器
        if (fireworksContainer) { // 如果容器存在
            fireworksContainer.innerHTML = ''; // 清空煙火內容
        }

        this.updateDisplay(); // 更新界面顯示
    }
}

// 頁面載入完成後初始化遊戲
document.addEventListener('DOMContentLoaded', () => { // 監聽DOM載入完成事件
    new TicTacToe(); // 創建遊戲實例，開始遊戲
});
