/* eslint no-param-reassign: 0 */
import debug from '../../../src/utils/debug';
import { getCurrentEndTime } from '../../../src/utils/countdownTimer';

/*
 * Function to intercept and process Websocket messages between students and teacher
 * to facilitate game play protocols for teacher.
 */
export default function teacherMessageHandler(message, context) {
  const data = message.value.msg;
  const { uid } = data;

  /* eslint no-param-reassign: 0 */
  /* 
   * Diasble @no-param-reassign to quickly register and check whether
   * message had been processed previously before processing.
   * - This is necessary due to repeated Websocket messages
   *   causing unnecessary updates to the core state.
   */
  if (context.messagesReceived[uid]) return;
  context.messagesReceived[uid] = true;
  
  const { gameState } = context.state;
  const { action, payload } = data;
  switch (action) {
    case 'REQUEST_GAME_STATE': {
      let newMessage = {};
      if (gameState.state.start || gameState.state.startQuiz || gameState.state.endGame) {
        const updatedGameState = { ...gameState };
        updatedGameState.state.reenter = true;
        updatedGameState.state.timeLeft = getCurrentEndTime();
        newMessage = {
          action: 'SET_GAME_STATE_FOR_LATE_PLAYER',
          uid: `${Math.random()}`,
          payload: updatedGameState,
        };
      } else {
        newMessage = {
          action: 'SET_GAME_STATE',
          uid: `${Math.random()}`,
          payload: gameState,
        };
      }
      context.IOTPublishMessage(newMessage);
      debug.log('REQUEST_GAME_STATE action processed');
      break;
    }
    case 'REQUEST_DROPPED_GAME_STATE': {
      const { username } = data;
      const newMessage = {
        action: 'SET_DROPPED_GAME_STATE',
        uid: `${Math.random()}`,
        payload: gameState,
        username,
      };
      context.IOTPublishMessage(newMessage);
      debug.log('REQUEST_DROPPED_GAME_STATE action processed');
      break;
    }
    case 'JOINED_GAME': {
      const { players } = context.state;
      const updatedPlayers = { ...players };
      updatedPlayers[payload.playerID] = payload.team;
      context.handleSetAppState('players', updatedPlayers);
      debug.log('JOINED_GAME action with payload:', JSON.stringify(payload));
      break;
    }
    case 'LEAVE_TEAM': {
      const { players } = context.state;
      const updatedPlayers = { ...players };
      delete updatedPlayers[payload.playerID];
      context.handleSetAppState('players', updatedPlayers);
      debug.log('LEAVE_TEAM action with payload:', JSON.stringify(payload));
      break;
    }
    case 'PUSH_TEAM_TRICK': {
      const { teamRef } = data;
      const updatedGameState = { ...gameState };
      updatedGameState[teamRef].tricks.push(payload);
      context.handleSetAppState('gameState', updatedGameState);
      debug.log('PUSH_TEAM_TRICK action with payload:', JSON.stringify(payload));
      break;
    }
    case 'UPDATE_TEAM_TRICK': {
      const updatedGameState = { ...gameState };
      const { index, teamRef } = data;
      updatedGameState[teamRef].tricks[index].selected = payload;
      context.handleSetAppState('gameState', updatedGameState);
      debug.log('UPDATE_TEAM_TRICK action with payload:', JSON.stringify(payload));
      break;
    }
    case 'UPDATE_PLAYER_CHOICE_AND_TEAM_POINTS': {
      const updatedGameState = { ...gameState };
      const { index, points, teamRef } = data;
      updatedGameState[teamRef].choices[index].votes += 1;
      updatedGameState[points.teamRef].points += points.value;
      context.handleSetAppState('gameState', updatedGameState);
      debug.log('UPDATE_PLAYER_CHOICE action with payload:', JSON.stringify(payload));
      break;
    }
    default:
      break;
  }
}
