import { remote } from 'electron';
import * as path from 'path';
import * as React from 'react';
import { Button, ControlLabel, FormGroup, HelpBlock } from 'react-bootstrap';
import { withTranslation } from 'react-i18next';
import { connect } from 'react-redux';
import * as Redux from 'redux';
import { ThunkDispatch } from 'redux-thunk';
import { DialogActions, DialogType, ICheckbox, IDialogContent, IDialogResult, showDialog } from '../../actions';
import { IState } from '../../types/IState';
import { ComponentEx } from '../../util/ComponentEx';
import * as fs from '../../util/fs';
import getVortexPath from '../../util/getVortexPath';
import relativeTime from '../../util/relativeTime';
import { FULL_BACKUP_PATH } from '../../util/store';
import { spawnSelf } from '../../util/util';

export interface IBaseProps {
  onCreateManualBackup: () => void;
}

interface IConnectedProps {
}

interface IActionProps {
  onShowDialog: (type: DialogType, title: string,
                 content: IDialogContent, actions: DialogActions) => Promise<IDialogResult>;
}

type IProps = IBaseProps & IActionProps & IConnectedProps;

class Settings extends ComponentEx<IProps, {}> {
  public render(): JSX.Element {
    const { t, onCreateManualBackup } = this.props;

    return (
      <form>
        <FormGroup id='database-backups' controlId='restore-backup'>
          <ControlLabel>{t('Database backup')}</ControlLabel>
          <div className='button-container'>
            <Button
              onClick={this.onSelectBackup}
            >
              {t('Restore') + '...'}
            </Button>
          </div>
          <div className='button-container'>
            <Button
              onClick={onCreateManualBackup}
            >
              {t('Create Backup')}
            </Button>
          </div>
          <HelpBlock>
            <div>
              {t('Vortex stores application settings as well as mod meta data and a lot '
                + 'of other important things in a database. Here you can restore a '
                + 'backup of this database (Vortex creates automatic updates). '
                + 'Please note that after this reset, the state may not agree with other '
                + 'data stored on disk, e.g. Vortex may report external file changes for things '
                + 'that it installed itself. Please be very careful to not lose data. '
                + 'We strongly advice you use this only in an emergency, not as an "undo" '
                + 'function.')}
            </div>
            <div>
              {t('You can have up to 3 backups: One is automatically created whenever Vortex '
                + 'starts up with no issue, one is automatically created hourly (while using '
                + 'Vortex) and one you can create manually.')}
            </div>
          </HelpBlock>
        </FormGroup>
      </form>
    );
  }

  private onSelectBackup = async () => {
    const { t, onShowDialog } = this.props;
    const basePath = path.join(getVortexPath('temp'), FULL_BACKUP_PATH);
    const locale = this.context.api.locale();

    const choices: ICheckbox[] = [];
    const files: string[] = await fs.readdirAsync(basePath);
    await Promise.all(files.map(async name => {
      const stats: fs.Stats = await fs.statAsync(path.join(basePath, name));
      if (!stats.isFile()) {
        return;
      }
      const time = stats.mtime.toLocaleString(locale);
      if (name === 'startup.json') {
        choices.push({
          id: 'startup',
          text: t('Last successful startup ({{time}})', { replace: { time } }),
          value: false,
        });
      } else if (name === 'hourly.json') {
        choices.push({
          id: 'hourly',
          text: t('Last hourly backup ({{time}})', { replace: { time } }),
          value: false,
        });
      } else if (name === 'manual.json') {
        choices.push({
          id: 'manual',
          text: t('Last manual backup ({{time}})', { replace: { time } }),
          value: false,
        });
      }
    }));
    const choice = await onShowDialog('question', 'Select backup', {
      text: 'Please select the backup to restore',
      choices,
    }, [
      { label: 'Cancel', default: true },
      { label: 'Restore' },
    ]);
    if  (choice.action !== 'Restore') {
      return;
    }

    const selected = Object.keys(choice.input).find(key => choice.input[key] === true);
    if (selected !== undefined) {
      const fileName = selected + '.json';
      const stats: fs.Stats = await fs.statAsync(path.join(basePath, fileName));
      const confirm = await onShowDialog('question', 'Confirm', {
        bbcode: 'Are you sure? This will reset Vortex settings and persistent data '
          + 'to a state from {{time}}.<br/><br/>'
          + 'It does not restore mods/files deleted or moved in the '
          + 'meantime and it does not undo deployments!<br/>'
          + '[color=red]If you changed the mod staging folder for any games or the download folder '
          + 'since the backup was created, do not continue![/color]<br/><br/>'
          + 'Please continue only if you know what you\'re doing!',
        parameters: {
          time: relativeTime(stats.mtime, t),
        },
      }, [
        { label: 'Cancel', default: true },
        { label: 'Confirm' },
      ]);
      if (confirm.action === 'Confirm') {
        spawnSelf(['--restore', path.join(basePath, selected + '.json')]);
        remote.app.exit();
      }
    }
  }
}

function mapStateToProps(state: IState): IConnectedProps {
  return {
  };
}

function mapDispatchToProps(dispatch: ThunkDispatch<any, null, Redux.Action>): IActionProps {
  return {
    onShowDialog: (type: DialogType, title: string,
                   content: IDialogContent, actions: DialogActions) =>
      dispatch(showDialog(type, title, content, actions)),
  };
}

export default
  withTranslation(['common'])(
    connect(mapStateToProps, mapDispatchToProps)(Settings) as any,
  ) as React.ComponentClass<{}>;
