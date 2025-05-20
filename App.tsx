import { StatusBar } from 'expo-status-bar';
import React, { useState, useEffect, useCallback } from 'react';
import { StyleSheet, Text, View, TouchableOpacity, Dimensions, Alert } from 'react-native';
import { Audio } from 'expo-av';

// --- Constants ---
const COLORS = {
  GREEN: 'green',
  RED: 'red',
  YELLOW: 'yellow',
  BLUE: 'blue',
};

const SOUNDS = {
  [COLORS.GREEN]: require('./assets/sounds/green.mp3'),
  [COLORS.RED]: require('./assets/sounds/red.mp3'),
  [COLORS.YELLOW]: require('./assets/sounds/yellow.mp3'),
  [COLORS.BLUE]: require('./assets/sounds/blue.mp3'),
  ERROR: require('./assets/sounds/error.mp3'),
};

const BUTTON_SIZE = Dimensions.get('window').width / 2 - 30;
const SEQUENCE_DELAY = 800; // ms between sequence lights
const HIGHLIGHT_DURATION = 300; // ms for button highlight

type ColorType = typeof COLORS[keyof typeof COLORS];

export default function App() {
  const [sequence, setSequence] = useState<ColorType[]>([]);
  const [playerSequence, setPlayerSequence] = useState<ColorType[]>([]);
  const [currentScore, setCurrentScore] = useState(0);
  const [highScore, setHighScore] = useState(0);
  const [gameState, setGameState] = useState<'idle' | 'watching' | 'playing' | 'gameOver'>('idle');
  const [activeButton, setActiveButton] = useState<ColorType | null>(null);
  const [soundObjects, setSoundObjects] = useState<Record<string, Audio.Sound | null>>({});

  // --- Sound Management ---
  useEffect(() => {
    async function loadSounds() {
      const loadedSounds: Record<string, Audio.Sound | null> = {};
      for (const key in SOUNDS) {
        if (SOUNDS[key as keyof typeof SOUNDS]) {
          try {
            const { sound } = await Audio.Sound.createAsync(SOUNDS[key as keyof typeof SOUNDS]!);
            loadedSounds[key] = sound;
          } catch (error) {
            console.error(error)
            loadedSounds[key] = null;
          }
        } else {
          loadedSounds[key] = null;
        }
      }
      setSoundObjects(loadedSounds);
    }
    loadSounds();

    return () => {
      Object.values(soundObjects).forEach(sound => {
        if (sound) {
          sound.unloadAsync();
        }
      });
    };
  }, []);

  const playSound = useCallback(async (color: ColorType | 'ERROR') => {
    const sound = soundObjects[color];
    if (sound) {
      try {
        await sound.replayAsync();
      } catch (error) {
        console.error(error)
      }
    } else {
      console.warn('sound not loaded or not provided');
    }
  }, [soundObjects]);


  // --- Game Logic ---
  const startGame = () => {
    setSequence([]);
    setPlayerSequence([]);
    setCurrentScore(0);
    setGameState('watching');
    addNewToSequence();
  };

  const addNewToSequence = () => {
    const colorsArray = Object.values(COLORS);
    const nextColor = colorsArray[Math.floor(Math.random() * colorsArray.length)];
    setSequence(prev => [...prev, nextColor]);
  };

  const playSequence = useCallback(async () => {
    if (gameState !== 'watching' || sequence.length === 0) return;

    for (let i = 0; i < sequence.length; i++) {
      const color = sequence[i];
      setActiveButton(color);
      playSound(color);
      await new Promise(resolve => setTimeout(resolve, HIGHLIGHT_DURATION));
      setActiveButton(null);
      if (i < sequence.length -1) { // Don't delay after the last item
        await new Promise(resolve => setTimeout(resolve, SEQUENCE_DELAY - HIGHLIGHT_DURATION));
      }
    }
    setGameState('playing');
    setPlayerSequence([]); // Clear player input for this round
  }, [sequence, playSound, gameState]);

  useEffect(() => {
    if (gameState === 'watching' && sequence.length > 0) {
      playSequence();
    }
  }, [sequence, gameState, playSequence]);


  const handlePlayerInput = (color: ColorType) => {
    if (gameState !== 'playing') return;

    playSound(color);
    setActiveButton(color);
    setTimeout(() => setActiveButton(null), HIGHLIGHT_DURATION / 2); // Shorter highlight for player press

    const newPlayerSequence = [...playerSequence, color];
    setPlayerSequence(newPlayerSequence);

    // Check if current input is correct
    if (newPlayerSequence[newPlayerSequence.length - 1] !== sequence[newPlayerSequence.length - 1]) {
      playSound('ERROR');
      setGameState('gameOver');
      if (currentScore > highScore) {
        setHighScore(currentScore);
      }
      Alert.alert("Game Over!", `Your score: ${currentScore}\nHigh Score: ${currentScore > highScore ? currentScore : highScore}`, [{ text: "Try Again", onPress: startGame }]);
      return;
    }

    // Check if sequence is complete
    if (newPlayerSequence.length === sequence.length) {
      setCurrentScore(prev => prev + 1);
      setGameState('watching');
      setTimeout(() => {
        addNewToSequence();
      }, 1000);
    }
  };

  // --- UI Rendering ---
  const renderButton = (color: ColorType, style: object) => (
    <TouchableOpacity
      style={[
        styles.button,
        style,
        { backgroundColor: color },
        activeButton === color && styles.activeButton,
        (gameState === 'watching' || gameState === 'gameOver') && styles.disabledButton
      ]}
      onPress={() => handlePlayerInput(color)}
      disabled={gameState !== 'playing'}
    >
    </TouchableOpacity>
  );

  if (gameState === 'idle') {
    return (
      <View style={styles.container}>
        <Text style={styles.title}>Genius Game</Text>
        <TouchableOpacity style={styles.startButton} onPress={startGame}>
          <Text style={styles.startButtonText}>Start Game</Text>
        </TouchableOpacity>
        {highScore > 0 && <Text style={styles.highScoreText}>High Score: {highScore}</Text>}
        <StatusBar style="auto" />
      </View>
    )
  }

  return (
    <View style={styles.container}>
      <StatusBar style="auto" />
      <Text style={styles.scoreText}>Score: {currentScore}</Text>
      {highScore > 0 && <Text style={styles.highScoreTextSmall}>High Score: {highScore}</Text>}
      <View style={styles.gameBoard}>
        <View style={styles.row}>
          {renderButton(COLORS.GREEN, styles.greenButton)}
          {renderButton(COLORS.RED, styles.redButton)}
        </View>
        <View style={styles.row}>
          {renderButton(COLORS.YELLOW, styles.yellowButton)}
          {renderButton(COLORS.BLUE, styles.blueButton)}
        </View>
      </View>
      {gameState === 'gameOver' && (
        <TouchableOpacity style={styles.startButton} onPress={startGame}>
          <Text style={styles.startButtonText}>Play Again?</Text>
        </TouchableOpacity>
      )}
       {gameState === 'watching' && <Text style={styles.statusText}>Watch the sequence...</Text>}
       {gameState === 'playing' && <Text style={styles.statusText}>Your turn!</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#2c3e50',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  title: {
    fontSize: 48,
    fontWeight: 'bold',
    color: '#ecf0f1',
    marginBottom: 40,
  },
  startButton: {
    backgroundColor: '#3498db',
    paddingVertical: 15,
    paddingHorizontal: 40,
    borderRadius: 10,
    marginBottom: 20,
    elevation: 5, 
    shadowColor: '#000', 
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
  },
  startButtonText: {
    color: '#fff',
    fontSize: 24,
    fontWeight: 'bold',
  },
  scoreText: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#ecf0f1',
    position: 'absolute',
    top: 60,
  },
  highScoreText: {
    fontSize: 24,
    color: '#bdc3c7',
    marginTop: 10,
  },
  highScoreTextSmall: {
    fontSize: 20,
    color: '#bdc3c7',
    position: 'absolute',
    top: 100,
  },
  statusText: {
    fontSize: 20,
    color: '#ecf0f1',
    marginTop: 20,
    fontStyle: 'italic',
  },
  gameBoard: {
    borderWidth: 5,
    borderColor: '#1abc9c',
    borderRadius: BUTTON_SIZE + 10,
    overflow: 'hidden',
    marginTop: 50,
    backgroundColor: '#16a085',
    width: BUTTON_SIZE * 2 + 20,
    height: BUTTON_SIZE * 2 + 20,
    justifyContent: 'center',
    alignItems: 'center',

  },
  row: {
    flexDirection: 'row',
  },
  button: {
    width: BUTTON_SIZE,
    height: BUTTON_SIZE,
    justifyContent: 'center',
    alignItems: 'center',
    margin: 5,
    borderWidth: 3,
    borderColor: 'rgba(0,0,0,0.2)',
  },
  greenButton: {
    backgroundColor: COLORS.GREEN,
    borderTopLeftRadius: BUTTON_SIZE,
  },
  redButton: {
    backgroundColor: COLORS.RED,
    borderTopRightRadius: BUTTON_SIZE, 
  },
  yellowButton: {
    backgroundColor: COLORS.YELLOW,
    borderBottomLeftRadius: BUTTON_SIZE,
  },
  blueButton: {
    backgroundColor: COLORS.BLUE,
    borderBottomRightRadius: BUTTON_SIZE,
  },
  activeButton: {
    opacity: 0.5,
    transform: [{ scale: 0.95 }],
  },
  disabledButton: {
    opacity: 0.7,
  },

});
