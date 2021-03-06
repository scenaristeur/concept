import React, { useContext, useState, useEffect } from 'react'

import { makeStyles } from '@material-ui/core/styles';
import Box from '@material-ui/core/Box';
import IconButton from '@material-ui/core/IconButton';
import TextField from '@material-ui/core/TextField';
import Typography from '@material-ui/core/Typography';
import AppBar from '@material-ui/core/AppBar';
import Toolbar from '@material-ui/core/Toolbar';

import SaveIcon from '@material-ui/icons/Save'
import ShareIcon from '@material-ui/icons/Share'
import BackupIcon from '@material-ui/icons/Backup'

import { schema} from 'rdf-namespaces';
import { useDebounce } from 'use-debounce';
import { useParams } from "react-router-dom";

import { Slate } from 'slate-react';

import Editable, {useEditor} from "./Editable";
import EditorToolbar from "./EditorToolbar";
import SharingModal from "./SharingModal";
import BackupsDialog from "./BackupsDialog";

import WorkspaceContext from "../context/workspace";
import PageDrawer from './PageDrawer';
import { LiveUpdate } from "@solid/react";
import { useLDflex } from '../hooks/ldflex';
import { useAccessInfo } from '../hooks/acls';
import { useBackups } from '../hooks/backup';
import {drawerWidth} from '../constants'

const useStyles = makeStyles(theme => ({
  saving: {
    position: "fixed",
    right: theme.spacing(0),
    top: "78px",
    zIndex: 1000,
    color: theme.palette.primary.light
  },
  appBar: {
    width: `calc(100% - ${drawerWidth}px)`,
    marginLeft: drawerWidth,
    background: "white"
  },
  editor: {
    position: "relative",
    height: "100%",
  },
  editable: {
    marginTop: "70px",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    textAlign: "left",
    padding: theme.spacing(1),
    paddingTop: 0,
    background: "white",
    position: "absolute"

  },
  toolbar: {
    top: "48px",
    position: "fixed",
    minHeight: theme.spacing(1),
    paddingLeft: 0,
    width: "100%",
    background: theme.palette.grey[50],
    zIndex: 100
  },
  shareButton: {
    float: "right"
  },
  grow: {
    flexGrow: 1,
  },
  sectionDesktop: {
    display: 'flex',
  },
}));

function PageName({workspace, page}){
  const {updatePage} = useContext(WorkspaceContext);
  const [editing, setEditing] = useState(false);
  const [savedNameNode] = useLDflex(`[${page}][${schema.name}]`);
  const savedName = savedNameNode && savedNameNode.toString();
  const [name, setName] = useState(savedName);
  useEffect(() => {
    savedName && setName(`${savedName}`);
  }, [savedName])

  const saveAndStopEditing = async () => {
    setEditing(false)
    await updatePage(page, schema.name, name)
  }

  return editing ? (
    <TextField label="Page Name" variant="standard" autoFocus
               value={name}
               onKeyDown={(e) => (e.key === 'Enter') && saveAndStopEditing()}
               onBlur={() => saveAndStopEditing()}
               onChange={(e) => setName(e.target.value)}/>
  ) : (
    <Typography variant="h5" onClick={() => setEditing(true)} noWrap>{name}</Typography>
  );
}

function PageTextEditor({page, readOnly}){
  const {updatePage} = useContext(WorkspaceContext);
  const classes = useStyles();
  const [saving, setSaving] = useState(false);
  const [pageTextNode] = useLDflex(`[${page}][${schema.text}]`);
  const pageText = pageTextNode && pageTextNode.value;
  const [editorValue, setEditorValue] = useState(undefined);
  const [saveNeeded, setSaveNeeded] = useState(false);
  const [debouncedValue] = useDebounce(editorValue, 1500);
  useBackups(page, editorValue)
  useEffect(() => {
    // set editor text to null when the page changes so we won't save page text from another page to the current page
    setEditorValue(undefined);
  }, [page])

  useEffect(() => {
    // once pageText loads, set editorValue
    if ((pageText !== undefined) && (pageText !== null)) {
      setEditorValue(currentValue => {
        if (JSON.stringify(currentValue) === pageText){
          return currentValue
        } else {
          return JSON.parse(pageText)
        }
      })
    }
  }, [pageText]);

  useEffect(() => {
    const maybeSave = async () => {
      const saveableText = JSON.stringify(debouncedValue);
      if (saveableText !== pageText) {
        setSaving(true);
        await updatePage(page, schema.text, saveableText);
        setSaving(false);
      }
    }
    if (saveNeeded) {
      setSaveNeeded(false);
      maybeSave();
    }
  }, [saveNeeded, page, pageText, debouncedValue, updatePage])

  useEffect(() => {
    if (debouncedValue !== undefined) {
      setSaveNeeded(true);
    }
  }, [debouncedValue])

  return (
    <div className={classes.editor}>
      {saving && <SaveIcon className={classes.saving}/>}
      {editorValue === undefined ? (
        <div>Loading...</div>
      ) : (
        <Editor value={editorValue === undefined ? [] : editorValue}
                handleChange={newValue => setEditorValue(newValue)}
                readOnly={readOnly} saving={saving}
        />
      )}
    </div>
  );
}

function Editor({value, handleChange, readOnly, saving}){
  const editor = useEditor()
  const classes = useStyles();
  return (
    <Slate editor={editor}
           value={value}
           onChange={handleChange}>
      {!readOnly && <EditorToolbar className={classes.toolbar} />}
      <Editable autoFocus readOnly={readOnly} editor={editor}
                className={classes.editable}/>
    </Slate>
  )
}

class EditorErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error) {
    // Update state so the next render will show the fallback UI.
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    // You can also log the error to an error reporting service
    console.log("error rendering editable", error, errorInfo);
  }

  render() {
    // just render the children - react will recreate from scratch
    return this.props.children;
  }
}

function Page({workspace, page}){
  const classes = useStyles();
  const [sharingModalOpen, setSharingModalOpen] = useState(false);
  const [backupsDialogOpen, setBackupsDialogOpen] = useState(false);
  const pageUri = page.toString()
  const { aclUri, allowed} = useAccessInfo(pageUri)
  const readOnly = !(allowed && allowed.user.has("write"))
  return (
    <>
      <AppBar position="fixed" className={classes.appBar} color="transparent" elevation={0}>
        <Toolbar variant="dense">
          <LiveUpdate subscribe={[workspace.toString()]}>
            <PageName workspace={workspace} page={page} />
          </LiveUpdate>
          <div className={classes.grow} />
          <div className={classes.sectionDesktop}>
            {
              allowed && allowed.user.has("control") && (
              <>
                <IconButton onClick={() => setSharingModalOpen(!sharingModalOpen)}>
                  <ShareIcon/>
                </IconButton>
                <IconButton onClick={() => setBackupsDialogOpen(!backupsDialogOpen)}>
                  <BackupIcon/>
                </IconButton>
              </>
              )
            }
          </div>
        </Toolbar>
      </AppBar>
      {aclUri && (
        <LiveUpdate subscribe={aclUri}>
          {page && (<SharingModal page={page} aclUri={aclUri} open={sharingModalOpen} onClose={() => setSharingModalOpen(false)}/>)}
        </LiveUpdate>
      )}
      {backupsDialogOpen && <BackupsDialog page={page} open={backupsDialogOpen} handleClose={() => setBackupsDialogOpen(false)}/>}
      {allowed && (
        <EditorErrorBoundary>
          <LiveUpdate subscribe={page.toString()}>
            <PageTextEditor page={page.toString()} readOnly={readOnly}/>
          </LiveUpdate>
        </EditorErrorBoundary>
      )}
    </>
  )
}

const usePagesStyles = makeStyles(theme => ({
  content: {
    flexGrow: 1,
    marginLeft: 240,
    position: "relative",
    height: "100%"
  },
}));

function CurrentPage({workspace}) {
  const { selectedPage } = useParams();
  const selectedPageURI = decodeURIComponent(selectedPage)
  return selectedPage ? (
    <LiveUpdate subscribe={selectedPageURI.toString()}>
      <Page workspace={workspace} page={selectedPageURI}/>
    </LiveUpdate>
  ) : (
    <p>Welcome to Concept! Add or select a page on the left to get started.</p>
  )
}

export default function Pages({workspace, addPage}){
  const classes = usePagesStyles()
  return (
    <>
      {workspace ? (
        <LiveUpdate subscribe={[workspace.toString()]}>
          <PageDrawer {...{workspace}}/>
        </LiveUpdate>
      ) : (
        <PageDrawer/>
      )}
      <Box className={classes.content}>
        {workspace && <CurrentPage workspace={workspace}/>}
      </Box>
    </>
  )
}
