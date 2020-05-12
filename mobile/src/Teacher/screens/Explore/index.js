import React from 'react';
import {
  ActivityIndicator,
  // Image,
  ScrollView,
  StatusBar,
  Text,
  View,
} from 'react-native';
import { screenPropsPropTypes, screenPropsDefaultProps } from '../../../config/propTypes';
import { scale, ScaledSheet } from 'react-native-size-matters';
import { getAdditionalGamesFromDynamoDB, getInitialGamesFromDynamoDB } from '../../../../lib/Categories/DynamoDB/ExploreGamesAPI';
import { playGame, saveGamesToDatabase } from '../../../utils/gamesBuilder';
import Message from '../../../components/Message';
// import Aicon from 'react-native-vector-icons/FontAwesome';
import Touchable from 'react-native-platform-touchable';
import { colors, deviceWidth, fonts } from '../../../utils/theme';
import debug from '../../../utils/debug';
import MainHeader from '../../components/MainHeader';
import GamesBuilder from '../Games/GamesBuilder';
import LocalStorage from '../../../../lib/Categories/LocalStorage';


class Explore extends React.PureComponent {
  static propTypes = {
    screenProps: screenPropsPropTypes,
  };
  
  static defaultProps = {
    screenProps: screenPropsDefaultProps,
  };
  
  constructor(props) {
    super(props);

    this.state = {
      data: [],
      loadingGames: true,
      messageProps: null,
      viewGame: null,
    };

    this.lastEvaluatedKey = null;
  }


  componentDidMount() {
    this.initializeGamesFromDynamoDB();
  }


  initializeGamesFromDynamoDB() {
    getInitialGamesFromDynamoDB(
      (res) => {
        debug.log('Successfully got result from GETTING games from DynamoDB for Explore:');
        this.hydrateState(res.data.Items);
        this.lastEvaluatedKey = res.data.LastEvaluatedKey;
      },
      exception => debug.warn('Error GETTING games from DynamoDB for Explore:', JSON.stringify(exception))
    );
  }


  hydrateGamesFromDynamoDB() {
    if (this.state.loadingGames || !this.lastEvaluatedKey) return;
    this.setState({ loadingGames: true });
    getAdditionalGamesFromDynamoDB(
      (res) => {
        debug.log('Successfully got result from GETTING games from DynamoDB for Explore:');
        this.hydrateState(res.data.Items, true);
        this.lastEvaluatedKey = res.data.LastEvaluatedKey;
      },
      exception => debug.warn('Error GETTING games from DynamoDB for Explore:', JSON.stringify(exception)),
      this.lastEvaluatedKey,
    );
  }


  hydrateState(data, extraData) {
    if (extraData) {
      this.setState({ data: [...this.state.data, ...data], loadingGames: false });
    } else {
      this.setState({ data, loadingGames: false });
    }
  }


  isCloseToBottom = ({ layoutMeasurement, contentOffset, contentSize }) => {
    const paddingToBottom = 20;
    return (layoutMeasurement.height + contentOffset.y >=
      contentSize.height - paddingToBottom);
  }


  handleCloseGame = () => this.setState({ viewGame: null });


  handleCreateGame = async (game) => {
    try {
      const { TeacherID } = this.props.screenProps.account;
      if (!TeacherID) {
        this.handleCloseGame();
        // TODO Display an option for the teacher to login/signup.
        this.handleShowMessage('Log in to clone and create games.');
        return;
      }
      let games = [];
      games = await LocalStorage.getItem(`@RightOn:${TeacherID}/Games`);
      if (typeof games === 'string') {
        games = JSON.parse(games);

        for (let i = 0; i < games.length; i += 1) {
          if (games[i].GameID === game.GameID) {
            // Prevent adding a game twice
            this.handleCloseGame();
            this.handleShowMessage('This game already exists in *My Games*.');
            return;
          }
        }

        games.unshift(game);

        const { account, handleSetAppState } = this.props.screenProps;
        saveGamesToDatabase(games, account, handleSetAppState);
        this.props.navigation.state.params = { reloadGames: true };
        this.handleShowMessage('Game has been cloned to *My Games*.');
      }
    } catch (exception) {
      debug.log('Caught exception getting Games from LocalStorage @Games, hydrateGames():', exception);
    }
    this.handleCloseGame();
  }


  handlePlayGame = (e, game) => {
    const { quizTime, trickTime } = this.props.screenProps.deviceSettings;
    const { handleSetAppState, IOTSubscribeToTopic } = this.props.screenProps;
    const { navigation } = this.props;

    playGame(
      game,
      quizTime,
      trickTime,
      handleSetAppState,
      this.handleCloseGame,
      navigation,
      IOTSubscribeToTopic,
    );
  }


  handleViewGame(data) {
    const parsedGame = {};
    parsedGame.GameID = data.GameID;
    parsedGame.title = data.title;
    parsedGame.description = data.description;
    parsedGame.grade = data.grade;
    parsedGame.domain = data.domain;
    parsedGame.cluster = data.cluster;
    parsedGame.standard = data.standard;
    parsedGame.questions = [];
    parsedGame.quizmaker = true;
    let questionIndex = 1;
    while (data[`q${questionIndex}`]) {
      parsedGame.questions.push(data[`q${questionIndex}`]);
      parsedGame.questions[questionIndex - 1].uid = `${Math.random()}`;
      questionIndex += 1;
    }
    this.setState({ viewGame: parsedGame });
  }


  handleCloseMessage = () => {
    this.setState({ messageProps: null });
  }


  handleShowMessage = (message) => {
    this.setState({
      messageProps: {
        closeFunc: this.handleCloseMessage,
        message,
      },
    });
  }


  renderDataBlock = (data) => {
    let ccs = '';
    if (data.grade === 'General') {
      ccs = 'General';
    } else if (data.grade && data.domain && data.cluster && data.standard) {
      ccs = `${data.grade === 'HS' ? '' : `${data.grade}.`}${data.domain}.${data.cluster}.${data.standard}`;
    }
    return (
      <Touchable
        activeOpacity={0.8}
        key={data.title || data.description}
        onPress={() => this.handleViewGame(data)}
      >
        <View style={[styles.dataContainer, { flexDirection: 'column', height: 150 }]}>
          {/* <View style={styles.dataBody}>
            <View style={styles.iconContainer}>
              <View style={styles.iconTextContainer}>
                <Text style={styles.iconText}>RightOn!</Text>
              </View>
            </View> */}
          <View style={styles.dataTextContainer}>
            <Text numberOfLines={2} style={styles.dataTextTitle}>{data.title}</Text>
            <Text numberOfLines={2} style={styles.dataTextDescription}>{data.description}</Text>
            <Text style={[styles.dataTextDescription, styles.ccs, styles.italic]}>{ ccs }</Text>
          </View>
          {/* </View> */}
        </View>
      </Touchable>
    );
  }


  renderData = data => (
    data.map(dataObj => this.renderDataBlock(dataObj))
  );


  render() {
    const {
      data,
      loadingGames,
      messageProps,
      viewGame,
    } = this.state;

    const { navigation } = this.props;

    if (viewGame) {
      return (
        <GamesBuilder
          explore // This let's us know that the game is viewed from Explore tab.
          handleClose={this.handleCloseGame}
          handleCreateGame={this.handleCreateGame}
          handlePlayGame={this.handlePlayGame}
          game={viewGame}
          visible
        />
      );
    }

    return (
      <View style={styles.container}>
        <StatusBar backgroundColor={colors.primary} />
        <MainHeader
          navigation={navigation}
          parent={'Explore'}
        />
        <ScrollView
          contentContainerStyle={styles.scrollview}
          indicatorStyle={'white'}
          showsVerticalScrollIndicator
          onScroll={({ nativeEvent }) => {
            if (this.isCloseToBottom(nativeEvent)) {
              this.hydrateGamesFromDynamoDB();
            }
          }}
          scrollEventThrottle={400}
        >
          {this.renderData(data)}
          {loadingGames &&
            <ActivityIndicator
              animating
              color={colors.white}
              size={'large'}
            />}
        </ScrollView>
        { messageProps && <Message {...messageProps} /> }
      </View>
    );
  }
}


const styles = ScaledSheet.create({
  banner: {
    height: '200@vs',
    width: deviceWidth - scale(30),
  },
  ccs: {
    bottom: 15,
    position: 'absolute',
    right: 15,
  },
  container: {
    flex: 1,
  },
  // dataBody: {
  //   flex: 1,
  //   flexDirection: 'row',
  //   height: '100@vs',
  // },
  dataContainer: {
    flexDirection: 'row',
    height: '100@vs',
    marginBottom: '15@vs',
    width: deviceWidth - scale(30),
  },
  dataTextContainer: {
    backgroundColor: colors.white,
    flex: 1,
    justifyContent: 'flex-start',
    padding: '10@s',
  },
  dataTextDescription: {
    color: colors.dark,
    fontSize: fonts.medium,
  },
  dataTextTitle: {
    color: colors.dark,
    fontSize: fonts.medium,
    fontWeight: 'bold',
  },
  // icon: {
  //   color: colors.white,
  //   fontSize: '35@ms0.2',
  // },
  // iconContainer: {
  //   alignItems: 'center',
  //   backgroundColor: colors.lightGray,
  //   height: '100@vs',
  //   justifyContent: 'center',
  //   width: '100@vs',
  // },
  // iconText: {
  //   color: colors.white,
  //   fontSize: fonts.small,
  //   fontStyle: 'italic',
  // },
  // iconTextContainer: {
  //   flexDirection: 'row',
  // },
  italic: {
    fontStyle: 'italic',
  },
  scrollview: {
    alignItems: 'center',
    backgroundColor: colors.dark,
    flexGrow: 1,
    paddingHorizontal: '15@s',
    paddingVertical: '25@vs',
  },
});


export default Explore;
