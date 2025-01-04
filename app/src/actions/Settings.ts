import * as q from '../../../backend/src/Model'
import { ActionTypes, SettingsStateModel, TopicOrder, ValueRendererDisplayMode } from '../reducers/Settings'
import { AppState } from '../reducers'
import { autoExpandLimitSet } from '../components/SettingsDrawer/Settings'
import { batchActions } from 'redux-batched-actions'
import { default as persistentStorage, StorageIdentifier } from '../utils/PersistentStorage'
import { Dispatch } from 'redux'
import { globalActions } from './'
import { showError } from './Global'
import { showTree } from './Tree'
import { TopicViewModel } from '../model/TopicViewModel'
import { PreprocessorType } from '../../../backend/src/Model/preprocessors/MessagePreprocessors'

const settingsIdentifier: StorageIdentifier<Partial<SettingsStateModel>> = {
  id: 'Settings',
}

export const loadSettings = () => async (dispatch: Dispatch<any>, getState: () => AppState) => {
  try {
    const settings = (await persistentStorage.load(settingsIdentifier)) || {}
    dispatch({
      settings: getState().settings.merge(settings),
      type: ActionTypes.SETTINGS_DID_LOAD_SETTINGS,
    })
  } catch (error) {
    dispatch(showError(error))
  }

  const parseParrisNamespace = getState().settings.get('parseParrisNamespace')
  const { tree } = getState().connection
  if (tree) {
    tree.setPreprocessor(parseParrisNamespace ? PreprocessorType.Parris : PreprocessorType.None)
  }

  dispatch(globalActions.didLaunch())
}

export const storeSettings = () => async (dispatch: Dispatch<any>, getState: () => AppState) => {
  const settings = {
    ...getState().settings.toJS(),
    autoExpandLimit: undefined,
    topicFilter: undefined,
    visible: undefined,
  }

  try {
    await persistentStorage.store(settingsIdentifier, settings)
  } catch (error) {
    dispatch(showError(error))
  }
}

export const setAutoExpandLimit =
  (autoExpandLimit: number = 0) =>
    (dispatch: Dispatch<any>) => {
      dispatch({
        autoExpandLimit,
        type: ActionTypes.SETTINGS_SET_AUTO_EXPAND_LIMIT,
      })
    }

export const setTimeLocale = (timeLocale: string) => (dispatch: Dispatch<any>) => {
  dispatch({
    timeLocale,
    type: ActionTypes.SETTINGS_SET_TIME_LOCALE,
  })
  dispatch(storeSettings())
}

export const selectTopicWithMouseOver = (doSelect: boolean) => (dispatch: Dispatch<any>) => {
  dispatch({
    selectTopicWithMouseOver: doSelect,
    type: ActionTypes.SETTINGS_SET_SELECT_TOPIC_WITH_MOUSE_OVER,
  })
  dispatch(storeSettings())
}

export const setValueDisplayMode =
  (valueRendererDisplayMode: ValueRendererDisplayMode) => (dispatch: Dispatch<any>) => {
    dispatch({
      valueRendererDisplayMode,
      type: ActionTypes.SETTINGS_SET_VALUE_RENDERER_DISPLAY_MODE,
    })
    dispatch(storeSettings())
  }

export const toggleHighlightTopicUpdates = () => (dispatch: Dispatch<any>) => {
  dispatch({
    type: ActionTypes.SETTINGS_TOGGLE_HIGHLIGHT_ACTIVITY,
  })
  dispatch(storeSettings())
}

export const toggleParseParrisNamespace = () => (dispatch: Dispatch<any>, getState: () => AppState) => {
  dispatch({
    type: ActionTypes.SETTINGS_TOGGLE_PARRIS_NAMESPACE,
  })
  const { tree } = getState().connection
  const parseParrisNamespace = getState().settings.get('parseParrisNamespace')

  if (parseParrisNamespace && tree) {
    tree.setPreprocessor(PreprocessorType.Parris)
  } else if (tree) {
    tree.setPreprocessor(PreprocessorType.None)
  }

  dispatch(storeSettings())
}

export const setTopicOrder =
  (topicOrder: TopicOrder = TopicOrder.none) =>
    (dispatch: Dispatch<any>) => {
      dispatch({
        topicOrder,
        type: ActionTypes.SETTINGS_SET_TOPIC_ORDER,
      })
      dispatch(storeSettings())
    }

export const filterTopics = (filterStr: string) => (dispatch: Dispatch<any>, getState: () => AppState) => {
  const { tree } = getState().connection

  dispatch({
    topicFilter: filterStr,
    type: ActionTypes.SETTINGS_FILTER_TOPICS,
  })

  if (!filterStr || !tree) {
    dispatch(batchActions([setAutoExpandLimit(0), showTree(tree) as any]))
    return
  }

  const topicFilter = filterStr.toLowerCase()

  const nodeFilter = (node: q.TreeNode<TopicViewModel>): boolean => {
    const topicMatches = node.path().toLowerCase().indexOf(topicFilter) !== -1
    if (topicMatches) {
      return true
    }

    const messageMatches =
      node.message &&
      node.message.payload &&
      node.message.payload.toUnicodeString().toLowerCase().indexOf(filterStr) !== -1

    return Boolean(messageMatches)
  }

  const resultTree = tree
    .childTopics()
    .filter(nodeFilter)
    .map((node: q.TreeNode<TopicViewModel>) => {
      const clone = node.unconnectedClone()
      q.TreeNodeFactory.insertNodeAtPosition(node.path().split('/'), clone)
      return clone.firstNode()
    })
    .reduce((a: q.TreeNode<TopicViewModel>, b: q.TreeNode<TopicViewModel>) => {
      a.updateWithNode(b)
      return a
    }, new q.Tree<TopicViewModel>())

  const nextTree: q.Tree<TopicViewModel> = resultTree as q.Tree<TopicViewModel>

  if (tree.updateSource && tree.connectionId) {
    nextTree.updateWithConnection(tree.updateSource, tree.connectionId, nodeFilter)
  }

  const parseParrisNamespace = getState().settings.get('parseParrisNamespace')
  tree.setPreprocessor(parseParrisNamespace ? PreprocessorType.Parris : PreprocessorType.None)

  dispatch(batchActions([setAutoExpandLimit(autoExpandLimitForTree(nextTree)), showTree(nextTree) as any]))
}

function autoExpandLimitForTree(tree: q.Tree<TopicViewModel>) {
  if (!tree) {
    return 0
  }

  function closestExistingLimit(i: number): number {
    const sorted = [...autoExpandLimitSet].sort((a, b) => Math.abs(a.limit - i) - Math.abs(b.limit - i))
    return sorted[0].limit
  }

  const count = tree.childTopicCount()
  const calculatedLimit = Math.max(7 - Math.log(count), 0) * 2

  return closestExistingLimit(calculatedLimit)
}

export const toggleTheme = () => (dispatch: Dispatch<any>, getState: () => AppState) => {
  dispatch({
    type:
      getState().settings.get('theme') === 'light'
        ? ActionTypes.SETTINGS_SET_THEME_DARK
        : ActionTypes.SETTINGS_SET_THEME_LIGHT,
  })
  dispatch(storeSettings())
}
