import { Button, InputNumber, Layout, Slider } from 'antd';
import { SliderValue } from 'antd/es/slider';
import * as React from 'react';
import { RouteComponentProps } from 'react-router';
import { Link } from 'react-router-dom';
import { ChartType } from '../../components/charts/AbstractChart';
import { HistoryChart } from '../../components/charts/HistoryChart';
import { WeightChart } from '../../components/charts/WeightChart';
import { TokenWeightDialog } from '../../components/dialogs/TokenWeightDialog';
import { TokensProportionsList } from '../../components/lists/proportion/TokensProportionsList';
import { TokenWeightList } from '../../components/lists/weight/TokenWeightList';
import PageContent from '../../components/page-content/PageContent';
import PageHeader from '../../components/page-header/PageHeader';
import { lazyInject, Services } from '../../Injections';
import { TokenManager } from '../../manager/multitoken/TokenManager';
import { TokenType } from '../../manager/multitoken/TokenManagerImpl';
import { Token } from '../../repository/models/Token';
import { TokenPriceHistory } from '../../repository/models/TokenPriceHistory';
import { TokenProportion } from '../../repository/models/TokenProportion';
import { TokenWeight } from '../../repository/models/TokenWeight';
import { DateUtils } from '../../utils/DateUtils';
import { TokensHelper } from '../../utils/TokensHelper';
import './ConfiguratorPage.less';

interface Props extends RouteComponentProps<{}> {
}

interface State {
  amount: number;
  calculateMaxDateIndex: number;
  calculateRangeDateIndex: SliderValue;
  changeWeightMinDates: [number, number];
  commissionPercents: number;
  exchangeAmount: number;
  historyChartRangeDateIndex: SliderValue;
  proportionList: TokenProportion[];
  tokenDialogOpen: boolean;
  tokenLatestWeights: Map<string, number>;
  tokenNames: Map<string, boolean>;
  tokensDate: number[];
  tokensHistory: Map<string, TokenPriceHistory[]>;
  tokensWeightEditItem: TokenWeight | undefined;
  tokensWeightList: TokenWeight[];
}

export default class ConfiguratorPage extends React.Component<Props, State> {

  @lazyInject(Services.TOKEN_MANAGER)
  private tokenManager: TokenManager;

  constructor(props: Props) {
    super(props);

    this.state = {
      amount: this.tokenManager.getAmount(),
      calculateMaxDateIndex: this.tokenManager.getMaxCalculationIndex() - 1,
      calculateRangeDateIndex: this.tokenManager.getCalculationDate(),
      changeWeightMinDates: this.tokenManager.getCalculationDate() as [number, number],
      commissionPercents: this.tokenManager.getCommission(),
      exchangeAmount: this.tokenManager.getExchangeAmount(),
      historyChartRangeDateIndex: this.tokenManager.getCalculationDate(),
      proportionList: [],
      tokenDialogOpen: false,
      tokenLatestWeights: new Map(),
      tokenNames: new Map(),
      tokensDate: [],
      tokensHistory: new Map(),
      tokensWeightEditItem: undefined,
      tokensWeightList: this.tokenManager.getRebalanceWeights(),
    };
  }

  public componentDidMount(): void {
    if (this.tokenManager.getPriceHistory().size === 0) {
      // Redirect to root
      window.location.replace('/simulator');
    }

    this.tokenManager
      .getAvailableTokens()
      .then(this.onSyncTokens.bind(this))
      .catch(reason => {
        console.log(reason);
        alert(reason.message);
      });
  }

  public render() {
    return (
      <Layout
        style={{
          minHeight: '100vh',
        }}
      >
        <PageHeader/>
        <div className="ConfiguratorPage__content">
          <PageContent className="ConfiguratorPage__content-left">
            <div className="ConfiguratorPage__options-title">Amount of money:&nbsp;</div>
            <InputNumber
              value={this.state.amount}
              step={Math.pow(10, this.state.amount.toString().length - 1)}
              formatter={value => `$ ${value || '0'}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
              parser={value => parseInt((value || '0').replace(/\$\s?|(,*)/g, ''), 10)}
              onChange={value => this.onAmountChange(value)}
              style={{width: '100%'}}
            />

            <div className="CalculatorPage__options-title">Exchange Amount (Optional):&nbsp;</div>
            <InputNumber
              value={this.state.exchangeAmount}
              step={Math.pow(10, this.state.exchangeAmount.toString().length - 1)}
              formatter={value => `$ ${value || '0'}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
              parser={value => parseInt((value || '0').replace(/\$\s?|(,*)/g, ''), 10)}
              onChange={value =>
                this.setState({
                  exchangeAmount:
                    Math.min(this.state.amount, Math.max(0, parseInt((value || '0').toString(), 10) || 0))
                })
              }
              style={{width: '100%'}}
            />

            <div
              className="ConfiguratorPage__options-title"
              style={{
                display: 'none',
              }}
            >
              Commission percents:&nbsp;
            </div>
            <InputNumber
              value={this.state.commissionPercents}
              step={0.01}
              formatter={value => `${value || '0'}%`}
              parser={value => parseFloat((value || '0').replace('%', ''))}
              max={99.99}
              min={0.01}
              onChange={value => this.onFeeChange(value)}
              style={{
                display: 'none',
                width: '100%',
              }}
            />

            <div>
              <div className="ConfiguratorPage__options-title">
                Period:
              </div>
              <div
                style={{
                  marginBottom: '10px',
                  width: '100%',
                }}
              >
                <Slider
                  step={1}
                  range={true}
                  disabled={this.state.tokensWeightList.length > 0}
                  max={this.state.calculateMaxDateIndex}
                  min={0}
                  defaultValue={[0, 10]}
                  tipFormatter={value => this.inputRangeTrackValue(value)}
                  value={this.state.calculateRangeDateIndex}
                  onChange={value => this.setState({calculateRangeDateIndex: value})}
                  onAfterChange={(value: SliderValue) => {
                    this.setState({historyChartRangeDateIndex: this.state.calculateRangeDateIndex});
                    this.tokenManager.changeCalculationDate(value[0], value[1]);
                  }}
                />
              </div>
            </div>

            <TokensProportionsList
              data={this.state.proportionList}
              disabled={this.state.tokensWeightList.length > 0}
              onChangeProportion={
                (name, value, position) => this.onChangeProportion(name, value, position)
              }
            />
          </PageContent>
          <div className="ConfiguratorPage__content-right-top">
            <PageContent className="ConfiguratorPage__content-weights">
              <div
                className="ConfiguratorPage__content-rebalance-blocked"
                style={{
                  display: this.tokenManager.getTokenType() !== TokenType.MANUAL_REBALANCE ? 'block' : 'none',
                }}
              >
                Disabled in selected type of multitoken.
              </div>
              <div
                className="ConfiguratorPage__options-title"
                style={{opacity: this.tokenManager.getTokenType() !== TokenType.MANUAL_REBALANCE ? 0.3 : 1}}
              >
                Change token weight:
              </div>
              <div
                className="ConfiguratorPage__result-chart"
                style={{opacity: this.tokenManager.getTokenType() !== TokenType.MANUAL_REBALANCE ? 0.3 : 1}}
              >
                <div style={{margin: '0px 20px 0px -20px'}}>
                  <WeightChart
                    applyScale={false}
                    data={this.state.tokensWeightList}
                    colors={TokensHelper.COLORS}
                    initialDate={this.state.tokensDate[this.state.calculateRangeDateIndex[0]]}
                    initialState={this.state.proportionList}
                    finishDate={this.state.tokensDate[this.state.calculateRangeDateIndex[1]]}
                    showRange={false}
                    aspect={3.5}
                    type={ChartType.BAR}
                  />
                </div>
                <div style={{margin: '0 20px 0px 45px'}}>
                  <TokenWeightList
                    maxHeight="200px"
                    onAddClick={() => this.onChangeTokenExchangeWeightClick(-1)}
                    onEditClick={(model, position) => this.onChangeTokenExchangeWeightClick(position, model)}
                    onDeleteClick={(model, position) => this.onDeleteTokenWeightClick(position)}
                    data={this.state.tokensWeightList}
                  />
                </div>
              </div>
              <div className="ConfiguratorPage__content-calculate">
                <Button
                  type="primary"
                  onClick={() => this.onCalculateClick()}
                >
                  Calculate
                </Button>
                <span className="m-2"/>
                <Link
                  className="ConfiguratorPage__content-button-start"
                  to={'/'}
                >
                  Start new
                </Link>
              </div>
            </PageContent>
            <PageContent className="ConfiguratorPage__content-bottom">
              <HistoryChart
                timeStep={this.tokenManager.getStepSec()}
                data={this.state.tokensHistory}
                colors={TokensHelper.COLORS}
                legendColumnCount={3}
                start={this.state.historyChartRangeDateIndex[0]}
                end={this.state.historyChartRangeDateIndex[1]}
                applyScale={true}
                showRange={false}
                showLegendCheckBox={true}
              />
            </PageContent>
          </div>
        </div>

        <TokenWeightDialog
          onOkClick={(tokenWeight, oldModel) => this.onTokenDialogOkClick(tokenWeight, oldModel)}
          onCancel={() => this.setState({tokenDialogOpen: false})}
          openDialog={this.state.tokenDialogOpen}
          tokenWeights={this.state.tokenLatestWeights}
          editTokenWeights={this.state.tokensWeightEditItem}
          maxWeight={10}
          rangeDateIndex={this.state.changeWeightMinDates}
          tokenNames={Array.from(this.tokenManager.getPriceHistory().keys())}
          dateList={this.state.tokensDate}
        />

      </Layout>
    );
  }

  private onChangeTokenExchangeWeightClick(position: number, model?: TokenWeight): void {
    const latestTokensWeight: Map<string, number> = new Map();
    const len: number = model ? this.state.tokensWeightList.length - 1 : this.state.tokensWeightList.length;

    for (let i = 0; i < len; i++) {
      const tokenPair = this.state.tokensWeightList[i].tokens;
      tokenPair.toArray().forEach((value2: Token) => {
        latestTokensWeight.set(value2.name, value2.weight);
      });
    }

    this.state.proportionList.forEach(value => {
      if (!latestTokensWeight.has(value.name)) {
        latestTokensWeight.set(value.name, value.weight);
      }
    });

    const weightList: TokenWeight[] = this.state.tokensWeightList;
    const minDateIndex: number = weightList.length > 0
      ? weightList[weightList.length - 1].index
      : this.state.calculateRangeDateIndex[0];

    this.setState({
      changeWeightMinDates: [model ? model.index : minDateIndex + 1, this.state.calculateRangeDateIndex[1]],
      tokenDialogOpen: true,
      tokenLatestWeights: latestTokensWeight,
      tokensWeightEditItem: model,
    });
  }

  private onDeleteTokenWeightClick(position: number): void {
    const list: TokenWeight [] = this.state.tokensWeightList.slice(0, this.state.tokensWeightList.length);

    list.splice(position, 1);

    this.setState({tokensWeightList: list});
  }

  private onTokenDialogOkClick(model: TokenWeight, oldModel: TokenWeight | undefined) {
    this.setState({tokenDialogOpen: false});
    const list: TokenWeight [] = this.state.tokensWeightList.slice(0, this.state.tokensWeightList.length);
    if (oldModel === undefined) {
      list.push(model);

    } else {
      list.splice(list.indexOf(oldModel), 1, model);
    }

    list.sort((a, b) => a.timestamp - b.timestamp);

    this.setState({tokensWeightList: list});
  }

  private inputRangeTrackValue(value: number): string {
    if (value > -1 && value <= this.state.tokensDate.length - 1) {
      return DateUtils.toFormat(this.state.tokensDate[value], DateUtils.DATE_FORMAT_SHORT);
    } else {
      return 'wrong date';
    }
  }

  private onChangeProportion(name: string, value: number, position: number) {
    const result: TokenProportion[] = this.state.proportionList.slice(0, this.state.proportionList.length);
    result[position].weight = value;
    this.setState({proportionList: result});
  }

  private onSyncTokens(tokens: Map<string, string>) {
    const tokenItems: Map<string, boolean> = new Map();
    let proportions: TokenProportion[] = [];

    tokens.forEach((value, key) => tokenItems.set(key, false));

    if (this.tokenManager.getProportions().length === 0) {
      this.tokenManager.getPriceHistory().forEach((value, key) => {
        proportions.push(new TokenProportion(key, 10, 1, 10));
      });
    } else {
      proportions = this.tokenManager.getProportions();
    }

    const firstTokenName: string = Array.from(this.tokenManager.getPriceHistory().keys())[0];
    const history: TokenPriceHistory[] = this.tokenManager.getPriceHistory().get(firstTokenName) || [];

    this.setState({tokensDate: history.map(value => value.time)});

    this.setState({
      proportionList: proportions,
      tokenNames: tokenItems,
      tokensHistory: this.tokenManager.getPriceHistory(),
    });
  }

  private onAmountChange(value: number | string | undefined) {
    const valueNumber = Number(value);

    if (valueNumber > 0) {
      this.setState({amount: valueNumber});
    }
  }

  private onFeeChange(value: number | string | undefined) {
    const valueNumber = Math.max(0.01, Math.min(99.99, Number(value)));

    if (valueNumber > 0) {
      this.setState({commissionPercents: valueNumber});
    }
  }

  private onCalculateClick() {
    this.tokenManager.setExchangeAmount(this.state.exchangeAmount || 0);
    this.tokenManager.changeProportions(this.state.proportionList);

    this.tokenManager.setRebalanceWeights(this.state.tokensWeightList);
    this.tokenManager.setCommission(this.state.commissionPercents);
    this.tokenManager.setAmount(this.state.amount);
    const {history} = this.props;
    history.push('calculator/result');
  }

}
