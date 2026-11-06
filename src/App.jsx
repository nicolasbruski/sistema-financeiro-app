import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Dialog } from "@/components/ui/native-dialog"
import { Input } from "@/components/ui/input"
import { NativeSelect } from "@/components/ui/native-select"
import {
  ChevronLeft,
  ChevronRight,
  CirclePlus,
  CreditCard,
  Eye,
  EyeOff,
  Banknote,
  GitBranch,
  Landmark,
  LayoutDashboard,
  LogOut,
  Pencil,
  PiggyBank,
  ReceiptText,
  SlidersHorizontal,
  WalletCards,
} from "lucide-react"

export default function App() {
  return (
    <>

    <section className="auth-gate" id="authGate" aria-labelledby="authTitle">
      <div className="auth-card">
        <span className="auth-mark" aria-hidden="true"><i></i><i></i><i></i></span>
        <p className="auth-eyebrow">Nosso Caixa</p>
        <h1 id="authTitle">Entre para acessar suas finanças</h1>
        <p id="authMessage">Os dados ficam em um arquivo JSON privado no seu repositório.</p>
        <Button asChild className="auth-button">
          <a href="/api/auth-login?v=2"><GitBranch aria-hidden="true" />Continuar com GitHub</a>
        </Button>
        <small>O acesso é liberado somente para usuários autorizados.</small>
      </div>
    </section>

    <header className="dashboard-header" aria-label="Navegação principal">
      <a className="brand" href="#inicio" aria-label="Nosso Caixa — início">
        <span className="brand-mark" aria-hidden="true"><i></i><i></i><i></i></span>
        <span><strong>nosso caixa</strong><small>finanças a dois</small></span>
      </a>
      <nav className="dashboard-tabs" aria-label="Áreas do dashboard">
        <a className="nav-item is-active" href="#inicio" data-view="inicio"><LayoutDashboard aria-hidden="true" />Dashboard</a>
        <a className="nav-item" href="#gastos" data-view="gastos"><ReceiptText aria-hidden="true" />Gastos</a>
        <a className="nav-item" href="#contas" data-view="contas"><CreditCard aria-hidden="true" />Dívidas</a>
      </nav>
      <div className="header-tools">
        <span className="sync-note"><i id="syncDot"></i><span id="syncText">Conectando ao armazenamento</span></span>
        <span className="github-user" id="githubUser" hidden></span>
        <Button className="privacy-button" id="privacyButton" variant="ghost" size="sm" type="button" aria-pressed="false">
          <Eye className="privacy-icon-show" aria-hidden="true" />
          <EyeOff className="privacy-icon-hide" aria-hidden="true" hidden />
          <span>Ocultar valores</span>
        </Button>
        <Button className="logout-button" id="logoutButton" variant="ghost" size="sm" hidden><LogOut aria-hidden="true" />Sair</Button>
      </div>
    </header>

    <main className="app-shell">
      <section className="period-bar" aria-label="Selecionar mês">
        <Button className="month-nav-button" id="previousMonth" aria-label="Mês anterior">
          <ChevronLeft aria-hidden="true" />
        </Button>
        <Button className="month-label" id="monthPicker" aria-label="Escolher mês"><span id="monthName"></span><small id="yearName"></small></Button>
        <Button className="month-nav-button" id="nextMonth" aria-label="Próximo mês">
          <ChevronRight aria-hidden="true" />
        </Button>
        <Button className="button close-month-button" id="closeMonthButton">Fechar mês</Button>
      </section>

      <section className="app-view" id="inicio" data-page="dashboard">
        <div className="dashboard-top-grid">
          <Card className="panel plan-panel income-spotlight" id="planejamento" aria-labelledby="planTitle">
            <div className="panel-heading">
              <div><h2 id="planTitle">Entradas do mês</h2><p>Rendas previstas e valores recebidos</p></div>
              <Button className="icon-button subtle" id="editPlan" aria-label="Editar entradas do mês"><Pencil aria-hidden="true" /></Button>
            </div>
            <div className="plan-summary">
              <div className="plan-gauge" id="planGauge"><span id="planPercent">0%</span></div>
              <div><strong id="incomeSpotlightValue">R$ 0,00</strong><p>recebidos e previstos neste mês</p></div>
            </div>
            <dl className="income-details">
              <div><dt>Disponível no orçamento</dt><dd id="remainingBudget">R$ 0,00</dd></div>
              <div><dt>Meta de reserva</dt><dd id="goalValue">R$ 0,00</dd></div>
            </dl>
          </Card>

          <section className="ledger-hero" aria-labelledby="balanceLabel">
          <div className="balance-block">
            <p id="balanceLabel">Saldo total do mês</p>
            <strong id="balanceValue">R$ 0,00</strong>
            <span id="balanceDelta">Calculando o mês...</span>
          </div>
          <div className="hero-chart-wrap">
            <canvas id="balanceChart" role="img" aria-label="Evolução do saldo durante o mês"></canvas>
          </div>
          <dl className="hero-totals">
            <div><dt>Entradas do mês</dt><dd className="positive" id="incomeValue">R$ 0,00</dd></div>
            <div><dt>Saídas</dt><dd id="expenseValue">R$ 0,00</dd></div>
            <div><dt>Gasolina no mês</dt><dd id="gasolineValue">R$ 0,00</dd></div>
            <div><dt>Após contas pendentes</dt><dd id="projectedValue">R$ 0,00</dd></div>
          </dl>
          </section>
        </div>

        <div className="dashboard-secondary-grid">
          <Card className="panel savings-panel" aria-labelledby="savedFundsTitle">
            <div className="panel-heading savings-heading">
              <div>
                <span className="savings-icon" aria-hidden="true"><PiggyBank /></span>
                <h2 id="savedFundsTitle">Dinheiro guardado</h2>
                <p>Sua reserva fora do saldo do mês</p>
              </div>
              <Button className="icon-button subtle" id="editSavedFunds" aria-label="Editar dinheiro guardado"><Pencil aria-hidden="true" /></Button>
            </div>
            <div className="savings-total">
              <span>Total guardado</span>
              <strong id="savedFundsTotal">R$ 0,00</strong>
            </div>
            <dl className="savings-breakdown">
              <div>
                <dt><span aria-hidden="true"><Landmark /></span>No banco</dt>
                <dd id="savedFundsBank">R$ 0,00</dd>
              </div>
              <div>
                <dt><span aria-hidden="true"><Banknote /></span>Em dinheiro</dt>
                <dd id="savedFundsCash">R$ 0,00</dd>
              </div>
            </dl>
          </Card>

          <section className="ownership-summary" aria-labelledby="ownershipTitle">
          <div className="ownership-heading">
            <div>
              <h2 id="ownershipTitle">Como o saldo está dividido</h2>
              <p>Veja o que é individual e o que pertence aos dois.</p>
            </div>
            <span className="total-note">O total acima soma os três valores</span>
          </div>
          <dl className="ownership-balances">
            <div className="owner-balance">
              <dt><span className="owner-dot owner-you" aria-hidden="true"></span>Dinheiro do Nicolas</dt>
              <dd id="yourBalance">R$ 0,00</dd>
              <small>Entradas e saídas de Nicolas</small>
            </div>
            <div className="owner-balance">
              <dt><span className="owner-dot owner-partner" aria-hidden="true"></span>Dinheiro da Isabella</dt>
              <dd id="partnerBalance">R$ 0,00</dd>
              <small>Entradas e saídas de Isabella</small>
            </div>
            <div className="owner-balance shared-balance">
              <dt><span className="owner-dot owner-shared" aria-hidden="true"></span>Dinheiro compartilhado</dt>
              <dd id="sharedBalance">R$ 0,00</dd>
              <small>O valor que pertence a vocês dois</small>
            </div>
          </dl>
          </section>

          <Card className="panel recent-panel" aria-labelledby="recentTitle">
            <div className="panel-heading">
              <div><h2 id="recentTitle">Últimas movimentações</h2><p>Atividade mais recente deste mês</p></div>
              <a className="panel-link" href="#gastos">Ver todas</a>
            </div>
            <div className="recent-transaction-list" id="recentTransactionList"></div>
          </Card>
        </div>

        <Card className="panel credit-panel" aria-labelledby="creditTitle">
          <div className="panel-heading credit-heading">
            <div>
              <span className="credit-icon" aria-hidden="true"><CreditCard /></span>
              <h2 id="creditTitle">Crédito disponível</h2>
              <p>Compras usam o limite; o saldo só diminui quando a fatura é paga.</p>
            </div>
            <div className="heading-actions credit-actions">
              <Button className="button button-secondary compact-action" id="openCards">Gerenciar cartões</Button>
              <Button className="button button-primary compact-action" id="openInstallment"><CirclePlus aria-hidden="true" /> Compra no cartão</Button>
            </div>
          </div>
          <div className="credit-summary">
            <div><span>Limite total</span><strong id="creditLimitTotal">R$ 0,00</strong></div>
            <div><span>Em uso</span><strong id="creditUsedTotal">R$ 0,00</strong></div>
            <div className="credit-available"><span>Disponível para usar</span><strong id="creditAvailableTotal">R$ 0,00</strong></div>
          </div>
          <div className="credit-card-overview" id="creditCardOverview"></div>
        </Card>

        <div className="dashboard-grid">
          <Card className="panel rhythm-panel" aria-labelledby="rhythmTitle">
            <div className="panel-heading">
              <div><h2 id="rhythmTitle">Ritmo do mês</h2><p>Gastos organizados por semana</p></div>
              <span className="budget-chip" id="budgetChip">Dentro do planejado</span>
            </div>
            <div className="week-list" id="weekList"></div>
          </Card>

          <Card className="panel category-panel" aria-labelledby="categoryTitle">
            <div className="panel-heading">
              <div><h2 id="categoryTitle">Para onde foi</h2><p>Distribuição das despesas</p></div>
            </div>
            <div className="category-chart">
              <div className="donut" id="categoryDonut"><span><strong id="categoryTotal">R$ 0</strong><small>em despesas</small></span></div>
              <ul className="legend" id="categoryLegend"></ul>
            </div>
          </Card>

        </div>
      </section>

      <section className="app-view records-view" id="lancamentos" data-page="records" hidden>
        <Card className="panel records-panel" id="billsPanel" aria-labelledby="billsTitle">
          <div className="panel-heading bills-heading">
            <div><h2 id="billsTitle">Contas do mês</h2><p id="billsSummary">Nenhuma conta cadastrada</p></div>
            <div className="heading-actions">              
              <Button className="button button-primary compact-action" id="openBill"><CirclePlus aria-hidden="true" /> Nova conta</Button>
            </div>
          </div>
          <div className="bill-list" id="billList"></div>
        </Card>

        <Card className="panel records-panel" id="expensesPanel" aria-labelledby="transactionTitle" hidden>
          <div className="panel-heading transaction-heading">
            <div><h2 id="transactionTitle">Gastos e movimentações</h2><p id="transactionCount">Nenhum lançamento</p></div>
            <div className="heading-actions transaction-actions">
              <Button className="button button-secondary compact-action filter-trigger" id="openTransactionFilters"><SlidersHorizontal aria-hidden="true" /> Filtros <span className="filter-count" id="transactionFilterBadge" hidden>0</span></Button>
              <Button className="button button-primary compact-action" id="openTransaction"><CirclePlus aria-hidden="true" /> Nova movimentação</Button>
            </div>
          </div>
          <div className="transaction-list" id="transactionList"></div>
        </Card>
      </section>

    </main>

    <nav className="mobile-nav" aria-label="Navegação móvel">
      <a className="is-active" href="#inicio" data-view="inicio"><LayoutDashboard aria-hidden="true" />Início</a>
      <a href="#gastos" data-view="lancamentos"><WalletCards aria-hidden="true" />Gastos</a>
      <a href="#contas" data-view="contas"><CreditCard aria-hidden="true" />Dívidas</a>
    </nav>

    <Dialog id="transactionDialog" className="dialog">
      <form method="dialog" id="transactionForm">
        <div className="dialog-head"><div><h2>Nova movimentação</h2><p>Inclua o que entrou ou saiu.</p></div><Button className="icon-button subtle" value="cancel" aria-label="Fechar">×</Button></div>
        <div className="dialog-fields">
          <div className="type-toggle" role="group" aria-label="Tipo de movimentação">
            <Input type="radio" name="type" id="expenseType" value="expense" defaultChecked /><label htmlFor="expenseType">Saída</label>
            <Input type="radio" name="type" id="incomeType" value="income" /><label htmlFor="incomeType">Entrada</label>
          </div>
          <label>Descrição<Input name="description" maxLength="60" placeholder="Ex.: Mercado da semana" /></label>
          <div className="form-row"><label>Valor<Input name="value" inputMode="decimal" placeholder="0,00" /></label><label>Data<Input name="date" type="date" /></label></div>
          <label>Categoria<NativeSelect name="category" id="categorySelect"></NativeSelect></label>
          <fieldset className="owner-picker" aria-describedby="ownerPickerHelp">
            <legend id="ownerPickerLegend">De quem é este valor?</legend>
            <p id="ownerPickerHelp">Escolha onde esta movimentação deve aparecer.</p>
            <div className="owner-options">
              <Input type="radio" name="paidBy" id="ownerYou" value="Você" defaultChecked />
              <label htmlFor="ownerYou"><strong>Nicolas</strong><span>Só no saldo de Nicolas</span></label>
              <Input type="radio" name="paidBy" id="ownerPartner" value="Namorada" />
              <label htmlFor="ownerPartner"><strong>Isabella</strong><span>Só no saldo de Isabella</span></label>
              <Input type="radio" name="paidBy" id="ownerShared" value="Casal" />
              <label htmlFor="ownerShared"><strong>Nosso</strong><span>No saldo compartilhado</span></label>
            </div>
          </fieldset>
          <fieldset className="sharing-fields" id="sharingFields">
            <legend>Para quem foi esta despesa?</legend>
            <div className="type-toggle">
              <Input type="radio" name="scope" id="individualScope" value="individual" defaultChecked /><label htmlFor="individualScope">Individual</label>
              <Input type="radio" name="scope" id="sharedScope" value="shared" /><label htmlFor="sharedScope">Compartilhada</label>
            </div>
            <label id="splitLabel" hidden>Parte de Nicolas (%)<Input name="splitYou" type="number" min="0" max="100" defaultValue="50" /></label>
          </fieldset>
        </div>
        <Button className="button button-primary full" type="submit">Salvar movimentação</Button>
      </form>
    </Dialog>

    <Dialog id="transactionFiltersDialog" className="dialog compact-dialog filter-dialog">
      <form method="dialog" id="transactionFiltersForm">
        <div className="dialog-head"><div><h2>Filtrar movimentações</h2><p>Encontre rapidamente o que entrou ou saiu.</p></div><Button className="icon-button subtle" value="cancel" aria-label="Fechar">×</Button></div>
        <div className="record-filters filter-sheet-fields" aria-label="Filtros de movimentações">
          <label className="search-field"><span>Buscar</span><Input id="transactionSearch" type="search" placeholder="Descrição ou categoria" /></label>
          <label><span>Tipo</span><NativeSelect id="transactionTypeFilter"><option value="">Todos</option><option value="expense">Saídas</option><option value="income">Entradas</option><option value="transfer">Transferências</option></NativeSelect></label>
          <label><span>Responsável</span><NativeSelect id="transactionOwnerFilter"><option value="">Todos</option><option value="Você">Nicolas</option><option value="Namorada">Isabella</option><option value="Casal">Compartilhado</option></NativeSelect></label>
          <label><span>Categoria</span><NativeSelect id="transactionCategoryFilter"><option value="">Todas</option></NativeSelect></label>
          <label><span>Ordem</span><NativeSelect id="transactionSort"><option value="date-desc">Mais recentes</option><option value="date-asc">Mais antigas</option><option value="value-desc">Maior valor</option><option value="description">Descrição</option></NativeSelect></label>
          <div className="filter-date-row">
            <label><span>De</span><Input id="transactionDateFrom" type="date" /></label>
            <label><span>Até</span><Input id="transactionDateTo" type="date" /></label>
          </div>
        </div>
        <p className="filter-preview" id="transactionFilterPreview">Todos os lançamentos serão mostrados.</p>
        <div className="filter-dialog-actions">
          <Button className="button button-secondary" type="button" id="clearTransactionFilters">Limpar</Button>
          <Button className="button button-primary" type="submit">Ver resultados</Button>
        </div>
      </form>
    </Dialog>

    <Dialog id="planDialog" className="dialog compact-dialog">
      <form method="dialog" id="planForm">
        <div className="dialog-head"><div><h2>Planejamento</h2><p>Informe a renda prevista de cada um no mês.</p></div><Button className="icon-button subtle" value="cancel" aria-label="Fechar">×</Button></div>
        <fieldset className="plan-owner-fields">
          <legend>Salários e rendas fixas</legend>
          <p>Os dois valores formam o limite mensal e contam como entradas nos saldos e no gráfico.</p>
          <div className="form-row">
            <label>Renda de Nicolas<Input name="yourBudget" inputMode="decimal" placeholder="0,00" /></label>
            <label>Renda de Isabella<Input name="partnerBudget" inputMode="decimal" placeholder="0,00" /></label>
          </div>
        </fieldset>
        <label>Meta para a reserva<Input name="goal"  inputMode="decimal" /></label>
        <Button className="button button-primary full" type="submit">Salvar planejamento</Button>
      </form>
    </Dialog>

    <Dialog id="savedFundsDialog" className="dialog compact-dialog">
      <form method="dialog" id="savedFundsForm">
        <div className="dialog-head"><div><h2>Dinheiro guardado</h2><p>Atualize quanto você tem no banco e em espécie.</p></div><Button className="icon-button subtle" value="cancel" aria-label="Fechar">×</Button></div>
        <div className="saved-funds-fields">
          <label><span><Landmark aria-hidden="true" />No banco</span><Input name="bank" inputMode="decimal" placeholder="0,00" /></label>
          <label><span><Banknote aria-hidden="true" />Em dinheiro</span><Input name="cash" inputMode="decimal" placeholder="0,00" /></label>
        </div>
        <p className="saved-funds-note">Esses valores não alteram o saldo mensal. Eles ficam salvos como sua reserva atual.</p>
        <Button className="button button-primary full" type="submit">Salvar valores</Button>
      </form>
    </Dialog>

    <Dialog id="billDialog" className="dialog compact-dialog">
      <form method="dialog" id="billForm">
        <div className="dialog-head"><div><h2>Nova conta do mês</h2><p>Registre faturas e despesas já previstas.</p></div><Button className="icon-button subtle" value="cancel" aria-label="Fechar">×</Button></div>
        <div className="dialog-fields">
          <label>Descrição<Input name="description" maxLength="60" placeholder="Ex.: Fatura do cartão" /></label>
          <div className="form-row"><label>Valor da parcela<Input name="value" inputMode="decimal" placeholder="0,00" /></label><label>Vencimento<Input name="dueDay" type="number" min="1" max="31" placeholder="10" /></label></div>
          <label>Quantidade de parcelas<Input name="installments" type="number" min="1" max="60" defaultValue="1" aria-describedby="billInstallmentsHelp" /><small id="billInstallmentsHelp">Use 1 para uma conta sem parcelas. As demais vencem nos meses seguintes.</small></label>
          <label>Categoria<NativeSelect name="category" id="billCategorySelect"></NativeSelect></label>
          <fieldset className="sharing-fields">
            <legend>Para quem é esta conta?</legend>
            <div className="type-toggle">
              <Input type="radio" name="scope" id="billIndividualScope" value="individual" defaultChecked /><label htmlFor="billIndividualScope">Individual</label>
              <Input type="radio" name="scope" id="billSharedScope" value="shared" /><label htmlFor="billSharedScope">Compartilhada</label>
            </div>
          </fieldset>
          <label className="check-row"><Input name="recurring" type="checkbox" /><span><strong>Repetir todos os meses</strong><small>A conta será criada automaticamente nos próximos meses.</small></span></label>
          <fieldset className="owner-picker" aria-describedby="billOwnerHelp">
            <legend>De qual saldo sairá?</legend>
            <p id="billOwnerHelp">Ao marcar a conta como paga, o valor será descontado deste saldo.</p>
            <div className="owner-options">
              <Input type="radio" name="paidBy" id="billOwnerYou" value="Você" defaultChecked />
              <label htmlFor="billOwnerYou"><strong>Nicolas</strong><span>Do saldo de Nicolas</span></label>
              <Input type="radio" name="paidBy" id="billOwnerPartner" value="Namorada" />
              <label htmlFor="billOwnerPartner"><strong>Isabella</strong><span>Do saldo de Isabella</span></label>
              <Input type="radio" name="paidBy" id="billOwnerShared" value="Casal" />
              <label htmlFor="billOwnerShared"><strong>Nosso</strong><span>Do saldo compartilhado</span></label>
            </div>
          </fieldset>
        </div>
        <Button className="button button-primary full" type="submit">Adicionar conta</Button>
      </form>
    </Dialog>

    <Dialog id="cardsDialog" className="dialog compact-dialog">
      <form method="dialog" id="cardForm">
        <div className="dialog-head"><div><h2>Cartões</h2><p>Cadastre o limite para acompanhar quanto ainda pode ser usado.</p></div><Button className="icon-button subtle" value="cancel" aria-label="Fechar">×</Button></div>
        <div className="card-list" id="cardList"></div>
        <div className="form-row"><label>Nome<Input name="name" maxLength="30" placeholder="Ex.: Nubank" /></label><label>Titular<NativeSelect name="owner"><option value="Você">Nicolas</option><option value="Namorada">Isabella</option><option value="Casal">Compartilhado</option></NativeSelect></label></div>
        <label>Limite do cartão<Input name="limit" inputMode="decimal" placeholder="0,00" /></label>
        <div className="form-row"><label>Fecha dia<Input name="closingDay" type="number" min="1" max="31" /></label><label>Vence dia<Input name="dueDay" type="number" min="1" max="31" /></label></div>
        <Button className="button button-primary full" type="submit" id="saveCardButton">Adicionar cartão</Button>
      </form>
    </Dialog>

    <Dialog id="installmentDialog" className="dialog compact-dialog">
      <form method="dialog" id="installmentForm">
        <div className="dialog-head"><div><h2>Compra no cartão</h2><p>A compra usa o limite agora e será cobrada na fatura correta.</p></div><Button className="icon-button subtle" value="cancel" aria-label="Fechar">×</Button></div>
        <label>Cartão<NativeSelect name="cardId" id="installmentCardSelect"></NativeSelect></label>
        <label>Descrição<Input name="description" maxLength="60" placeholder="Ex.: Notebook" /></label>
        <div className="form-row"><label>Valor total<Input name="value" inputMode="decimal" placeholder="0,00" /></label><label>Parcelas<Input name="installments" type="number" min="1" max="60" defaultValue="1" /><small>Use 1 para compra à vista no cartão.</small></label></div>
        <div className="form-row"><label>Data da compra<Input name="purchaseDate" type="date" /></label><label>Categoria<NativeSelect name="category" id="installmentCategorySelect"></NativeSelect></label></div>
        <div className="type-toggle">
          <Input type="radio" name="scope" id="installmentIndividual" value="individual" defaultChecked /><label htmlFor="installmentIndividual">Individual</label>
          <Input type="radio" name="scope" id="installmentShared" value="shared" /><label htmlFor="installmentShared">Compartilhada</label>
        </div>
        <Button className="button button-primary full" type="submit">Registrar compra</Button>
      </form>
    </Dialog>

    <Dialog id="closeMonthDialog" className="dialog compact-dialog">
      <form method="dialog" id="closeMonthForm">
        <div className="dialog-head"><div><h2>Fechar o mês</h2><p>Revise o resultado antes de iniciar o próximo.</p></div><Button className="icon-button subtle" value="cancel" aria-label="Fechar">×</Button></div>
        <div className="close-summary" id="closeMonthSummary"></div>
        <label>Valor efetivamente reservado<Input name="savedAmount" inputMode="decimal" placeholder="0,00" /></label>
        <label className="check-row"><Input name="carryPending" type="checkbox" defaultChecked /><span><strong>Levar pendências para o próximo mês</strong><small>Contas ainda não pagas continuarão visíveis.</small></span></label>
        <Button className="button button-primary full" type="submit">Confirmar fechamento</Button>
      </form>
    </Dialog>

    <Dialog id="settlementDialog" className="dialog compact-dialog">
      <form method="dialog" id="settlementForm">
        <div className="dialog-head"><div><h2>Registrar acerto</h2><p>Uma transferência não altera as despesas do casal.</p></div><Button className="icon-button subtle" value="cancel" aria-label="Fechar">×</Button></div>
        <div className="settlement-detail" id="settlementDetail"></div>
        <label>Data<Input name="date" type="date" /></label>
        <Button className="button button-primary full" type="submit">Registrar transferência</Button>
      </form>
    </Dialog>

    <div className="toast" id="toast" role="status" aria-live="polite"></div>
  
    </>
  )
}
