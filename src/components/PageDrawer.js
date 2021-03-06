import React, { useContext } from 'react';
import { useParams, Link } from "react-router-dom";
import { makeStyles } from '@material-ui/core/styles';
import Drawer from '@material-ui/core/Drawer';
import Button from '@material-ui/core/Button';
import List from '@material-ui/core/List';
import ListItem from '@material-ui/core/ListItem';
import ListItemText from '@material-ui/core/ListItemText';
import {useLDflexValue, useLDflexList} from '../hooks/ldflex';
import { schema } from 'rdf-namespaces';

import WorkspaceContext from "../context/workspace";
import LogInLogOutButton from './LogInLogOutButton';
import {drawerWidth} from '../constants'
import logo from '../logo.svg'

const useStyles = makeStyles(theme => ({
  drawer: {
    width: drawerWidth,
    flexShrink: 0,
  },
  drawerPaper: {
    width: drawerWidth,
  },
  toolbar: theme.mixins.toolbar,
  logo: {
    height: "4em",
    paddingTop: theme.spacing(1),
  },
  version: {
    fontWeight: theme.typography.fontWeightBold,
    display: "inline-block",
  },
  item: {
    "& a": {
      width: "100%",
      textDecoration: "none",
      color: theme.palette.text.primary,
      "&:visited": {
        color: theme.palette.text.primary
      }
    },
    "&.selected": {
      background: theme.palette.grey[50]
    },
    "& button": {
      position: "absolute",
      right: 0
    }
  }
}));

const PageListItem = ({workspace, page}) => {
  const {deletePage} = useContext(WorkspaceContext);
  const { selectedPage } = useParams();
  const classes = useStyles()
  const name = useLDflexValue(`from('${workspace}')[${page}][${schema.name}]`);
  const encodedPage = encodeURIComponent(page)
  return (
    <ListItem className={`${(selectedPage === encodedPage) && 'selected'} ${classes.item}`}>
      <Link to={`/page/${encodedPage}`}>
        <ListItemText primary={`${name || ""}`} />
      </Link>
      <Button onClick={() => deletePage(page)}>Delete</Button>
    </ListItem>
  )
}

const PageNameList = ({workspace}) => {
  const pages = useLDflexList(`[${workspace}][${schema.itemListElement}]`);
  return (
    <List>
      {pages && pages.map((page, index) => (
        <PageListItem workspace={workspace} page={page} key={index}/>
      ))}
    </List>
  )
}

export default ({workspace, deletePage}) => {
  const {addPage} = useContext(WorkspaceContext);
  const classes = useStyles()
  return (
    <Drawer
      className={classes.drawer}
      variant="permanent"
      classes={{
        paper: classes.drawerPaper,
      }}
      anchor="left"
    >
      <div className={classes.toolbar}>
        <img src={logo} className={classes.logo} alt="logo"/>
        <p className={classes.version}>alpha</p>
      </div>
      {workspace && <PageNameList {...{workspace}}/>}
      {workspace && <Button onClick={() => addPage()}>Add Page</Button>}
      <LogInLogOutButton/>
    </Drawer>

  )
}
